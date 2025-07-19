import { HttpClient } from './http-client';
// Corrected import paths to point to the 'services' subdirectory
import { LibraryService } from './services/library-service';
import { CollectionService } from './services/collections-service';
import { VideoService } from './services/video-service';
import { BandwidthService } from './services/bandwidth-service';
import { ViewsService } from './services/views-service';
import { UploadService } from './services/upload-service'; // Corrected path for UploadService
import { dataStorage } from '../data-storage';
import { cache } from '../cache';
import type { UploadProgress, Collection, Video, Library } from './types'; // Import necessary types
import type { LibraryData } from '../../types/library-data';

// Declare Vite env types for this file
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface ImportMetaEnv {
    readonly VITE_BUNNY_API_KEY: string | undefined;
    [key: string]: string | undefined;
  }
}

export class BunnyService {
  private baseUrl = "http://localhost:800";  // Use local proxy instead of direct API
  private videoBaseUrl = "http://localhost:800";  // Use local proxy instead of direct API
  private httpClient: HttpClient;

  private libraryService: LibraryService;
  private collectionService: CollectionService;
  private videoService: VideoService;
  private bandwidthService: BandwidthService;
  private viewsService: ViewsService;
  private uploadService: UploadService;

  private publicApiKey: string;
  private currentLibraryKey: string | null = null;
  private apiKey: string;
  private initialized = false;
  private initializationError: string | null = null;
  private mainApiKey: string;

  constructor() {
    // Only use environment variable, no prompts
    this.publicApiKey = import.meta.env.VITE_BUNNY_API_KEY || "";
    this.apiKey = this.publicApiKey;

    if (this.publicApiKey) {
      cache.set('default_api_key', this.publicApiKey);
    } else {
      console.warn('VITE_BUNNY_API_KEY environment variable is not set');
    }

    // Initialize services with base URLs and API key
    this.httpClient = new HttpClient(this.baseUrl, this.apiKey);
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, this.videoBaseUrl);
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl);
    this.bandwidthService = new BandwidthService(this.httpClient);
    this.viewsService = new ViewsService(this.httpClient);
    this.uploadService = new UploadService(this.httpClient, this.videoBaseUrl);

    this.mainApiKey = this.publicApiKey;
  }

  async initialize(): Promise<void> {
    try {
      const savedData = await dataStorage.getLibraryData();
      if (savedData) {
        this.setLibraryApiKey('default', savedData.mainApiKey);
        savedData.libraries.forEach(lib => {
          if (lib.apiKey) {
            cache.set(`library_${lib.id}_api`, lib.apiKey);
          }
        });
        this.initialized = true;
        return;
      }

      const data = await this.initializeFromAPI();
      this.setLibraryApiKey('default', data.mainApiKey);
      data.libraries.forEach(lib => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing BunnyService:', error);
      this.initializationError = error instanceof Error ? error.message : String(error);
    }
  }

  private async storeLibraryData(data: LibraryData): Promise<void> {
    await dataStorage.saveLibraryData(data);
  }

  private async initializeFromAPI(): Promise<LibraryData> {
    try {
      const libraries = await this.libraryService.getLibraries();
      const data: LibraryData = {
        lastUpdated: new Date().toISOString(),
        date: new Date(),
        libraries,
        mainApiKey: this.apiKey
      };
      await this.storeLibraryData(data);
      return data;
    } catch (error) {
      console.error('Failed to initialize from API:', error);
      throw error;
    }
  }

  setLibraryApiKey(libraryId: string, apiKey: string): void {
    cache.set(`library_${libraryId}_api`, apiKey);
    if (apiKey) {
      this.currentLibraryKey = apiKey;
      localStorage.setItem("bunny_api_key", apiKey);
      // Update HttpClient's default key if this is the main key being set
      if (libraryId === 'default') {
        this.httpClient.setApiKey(apiKey);
      } else {
        // Set the library-specific key in HttpClient
        this.httpClient.setLibraryApiKey(libraryId, apiKey);
      }
    }
  }

  // Delegate methods to specific services
  getLibraries = (): Promise<Library[]> => this.libraryService.getLibraries();
  getLibrary = (libraryId: string): Promise<Library | null> => this.libraryService.getLibrary(libraryId); // Fix return type
  getCollections = (libraryId: string): Promise<Collection[]> => this.collectionService.getCollections(libraryId);
  // Update createCollection to accept accessToken
  createCollection = (libraryId: string, name: string, accessToken?: string): Promise<Collection> =>
    this.collectionService.createCollection(libraryId, name, accessToken);
  
  getVideos = (libraryId: string, collectionId?: string, accessToken?: string): Promise<Video[]> =>
    this.videoService.getVideos(libraryId, collectionId, accessToken);
  getVideoEmbedCode = (libraryId: string, videoGuid: string): string =>
    this.videoService.getEmbedCode(libraryId, videoGuid);
  getVideoDetails = (libraryId: string, videoGuid: string, accessToken?: string) =>
    this.videoService.getVideoDetails(libraryId, videoGuid, accessToken);

  // Upload operations
  uploadVideo = (
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string, // This should be the GUID
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string }> => this.uploadService.uploadVideo(file, libraryId, onProgress, collectionId, accessToken, signal);

  // Add this method to expose the streaming upload functionality
  uploadVideoWithStreams = (
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string, // This should be the GUID
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string }> => this.uploadService.uploadVideoWithStreams(file, libraryId, onProgress, collectionId, accessToken, signal);
  
  getBandwidthStats = () => this.bandwidthService.getBandwidthStats();
  
  // Views statistics methods
  getViewsStats = () => this.viewsService.getAllLibrariesViewsStats();
  getMonthlyViews = (year: number, month: number) => this.viewsService.getMonthlyViewsForAllLibraries(year, month);
  
  // Video download URL generation
  generateDownloadUrl = (libraryId: string, videoGuid: string, quality?: string): string =>
    this.videoService.generateDownloadUrl(libraryId, videoGuid, quality);
    
  generateMultipleDownloadUrls = (libraryId: string, videoGuid: string, quality?: string): string[] =>
    this.videoService.generateMultipleDownloadUrls(libraryId, videoGuid, quality);
}

export const bunnyService = new BunnyService();
