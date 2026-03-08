import type { AircraftModel } from "@acars/core";
import {
  type CatalogImageRecord,
  loadCatalogImages,
  publishCatalogImage,
  uploadToBlossom,
} from "@acars/nostr";
import { useEffect, useRef, useState } from "react";
import {
  buildCatalogPrompt,
  computeCatalogPromptHash,
  generateLiveryImage,
  isLiveryApiUnavailable,
} from "../services/aircraftImageService";
import { getCachedImage, setCachedImage } from "../services/imageCache";
import { dequeueImageGeneration, enqueueImageGeneration } from "../services/imageGenerationQueue";

const activeCatalogGenerations = new Set<string>();
const loadedCatalogImages = new Map<string, CatalogImageRecord>();
let catalogImagesLoaded = false;
let catalogImagesPromise: Promise<Map<string, CatalogImageRecord>> | null = null;

async function ensureCatalogImagesLoaded() {
  if (catalogImagesLoaded) return loadedCatalogImages;
  if (!catalogImagesPromise) {
    catalogImagesPromise = loadCatalogImages()
      .then((records) => {
        loadedCatalogImages.clear();
        for (const [modelId, record] of records) {
          loadedCatalogImages.set(modelId, record);
        }
        catalogImagesLoaded = true;
        return loadedCatalogImages;
      })
      .catch((error) => {
        console.warn("[CatalogImage] Failed to load shared catalog images:", error);
        return loadedCatalogImages;
      })
      .finally(() => {
        catalogImagesPromise = null;
      });
  }

  return catalogImagesPromise ?? loadedCatalogImages;
}

export interface UseCatalogImageResult {
  imageUrl: string | null;
  isGenerating: boolean;
  error: string | null;
}

export function useCatalogImage(model: AircraftModel): UseCatalogImageResult {
  const [imageUrl, setImageUrl] = useState<string | null>(model.catalogImageUrl ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localObjectUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (localObjectUrlRef.current) {
        URL.revokeObjectURL(localObjectUrlRef.current);
        localObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (model.catalogImageUrl) {
      setImageUrl(model.catalogImageUrl);
      return;
    }

    if (activeCatalogGenerations.has(model.id)) return;

    let cancelled = false;

    async function maybeResolveImage() {
      const promptHash = await computeCatalogPromptHash(model);
      if (cancelled) return;

      const sharedRecords = await ensureCatalogImagesLoaded();
      const sharedRecord = sharedRecords.get(model.id);
      if (cancelled) return;

      if (sharedRecord && sharedRecord.promptHash === promptHash) {
        setImageUrl(sharedRecord.imageUrl);
        return;
      }

      const cacheKey = `catalog:${model.id}:${promptHash}`;
      const cached = await getCachedImage(cacheKey);
      if (cancelled) return;

      if (cached) {
        const objectUrl = URL.createObjectURL(cached);
        if (isMountedRef.current) {
          if (localObjectUrlRef.current) {
            URL.revokeObjectURL(localObjectUrlRef.current);
          }
          localObjectUrlRef.current = objectUrl;
          setImageUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }

        activeCatalogGenerations.add(model.id);
        try {
          const filename = `catalog-${model.id}.png`;
          const blossomUrl = await uploadToBlossom(cached, filename, "image/png");
          const record = {
            modelId: model.id,
            promptHash,
            imageUrl: blossomUrl,
            updatedAt: Date.now(),
          };
          await publishCatalogImage(record);
          loadedCatalogImages.set(model.id, record);
          if (isMountedRef.current) {
            setImageUrl(blossomUrl);
          }
        } catch (uploadError) {
          console.warn(
            `[CatalogImage] Failed to persist cached catalog image for ${model.id}:`,
            uploadError,
          );
        } finally {
          activeCatalogGenerations.delete(model.id);
        }
        return;
      }

      if (isLiveryApiUnavailable()) return;

      activeCatalogGenerations.add(model.id);
      setIsGenerating(true);
      setError(null);

      enqueueImageGeneration(async () => {
        try {
          const prompt = buildCatalogPrompt(model);
          const imageBlob = await generateLiveryImage(prompt);
          await setCachedImage(cacheKey, imageBlob);

          const objectUrl = URL.createObjectURL(imageBlob);
          if (isMountedRef.current) {
            if (localObjectUrlRef.current) {
              URL.revokeObjectURL(localObjectUrlRef.current);
            }
            localObjectUrlRef.current = objectUrl;
            setImageUrl(objectUrl);
          } else {
            URL.revokeObjectURL(objectUrl);
          }

          const filename = `catalog-${model.id}.png`;
          const blossomUrl = await uploadToBlossom(imageBlob, filename, "image/png");
          const record = {
            modelId: model.id,
            promptHash,
            imageUrl: blossomUrl,
            updatedAt: Date.now(),
          };
          await publishCatalogImage(record);
          loadedCatalogImages.set(model.id, record);
          if (isMountedRef.current) {
            setImageUrl(blossomUrl);
          }
        } catch (generationError) {
          const message =
            generationError instanceof Error
              ? generationError.message
              : "Catalog image generation failed";
          if (isMountedRef.current) {
            setError(message);
          }
          console.error(`[CatalogImage] Generation failed for ${model.id}:`, generationError);
        } finally {
          activeCatalogGenerations.delete(model.id);
          if (isMountedRef.current) {
            setIsGenerating(false);
          }
          dequeueImageGeneration();
        }
      });
    }

    maybeResolveImage();

    return () => {
      cancelled = true;
    };
  }, [model]);

  return {
    imageUrl,
    isGenerating,
    error,
  };
}
