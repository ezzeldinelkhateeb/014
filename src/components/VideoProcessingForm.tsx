import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Download, Loader2, Save, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Year } from "../types/common";
import { UploadManager } from "../lib/upload-manager";
import { bunnyService } from "../lib/bunny-service";

// Import UI components
import LibrarySettings from './video-processing/LibrarySettings';
import AutomaticUploadSection from './video-processing/AutomaticUploadSection';
import ProcessingQueueSection from './video-processing/ProcessingQueueSection';
import VideoManagementSection from './video-processing/VideoManagementSection';
import UploadReport from "./UploadReport";
import SheetUpdateReport from "./SheetUpdateReport";
import AdvancedSettings from "./video-processing/AdvancedSettings";
import ToolbarSection from "./video-processing/ToolbarSection";
import SheetUpdateOnlyReport from './SheetUpdateOnlyReport';

// Import hooks
import { useToast } from "../hooks/use-toast";
import { useSheetUpdater } from "../hooks/useSheetUpdater";
import { useLibraries } from "../hooks/useLibraries";
import { useVideos } from "../hooks/useVideos";
import { useFileUploader } from "../hooks/useFileUploader";
import { useUploadQueue } from "../hooks/useUploadQueue";
import { useSheetUpdateReportManager } from '../hooks/useSheetUpdateReportManager';

// Types
import { UploadGroup as ComponentUploadGroup, LibraryInterface, CollectionInterface } from './video-processing/types';
import { UploadGroup as LibUploadGroup, UploadResult } from '../lib/upload/types';
import { Library } from '../lib/bunny/types'; // Import the Library type

interface VideoProcessingFormProps {
  libraries?: LibraryInterface[];
  collections?: CollectionInterface[];
  selectedLibrary?: string;
  selectedCollection?: string;
  selectedYear?: Year;
  onLibraryChange?: (value: string) => void;
  onCollectionChange?: (value: string) => void;
  onYearChange?: (value: Year) => void;
  disabled?: boolean;
}

const VideoProcessingForm = ({
  libraries = [],
  collections = [],
  selectedLibrary = "",
  selectedCollection = "",
  selectedYear = "2025",
  onLibraryChange = () => {},
  onCollectionChange = () => {},
  onYearChange = () => {},
  disabled = false
}: VideoProcessingFormProps) => {
  const { toast } = useToast();
  const uploadManagerRef = useRef<UploadManager | null>(null);
  
  // State hooks grouped by functionality
  const [uploadGroups, setUploadGroups] = useState<ComponentUploadGroup[]>([]);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadSettings, setUploadSettings] = useState({
    chunkSize: 20 * 1024 * 1024, // 20MB default
    maxConcurrentUploads: 4,
    useStreamingUpload: true
  });

  // Add a ref to track whether the current results have been shown
  const reportShownRef = useRef(false);

  // Use custom hooks
  const { 
    updateSheetForVideo, 
    handleUpdateSheet,
    handleUpdateFinalMinutes,
    isUpdatingSheet,
    isUpdatingFinalMinutes,
    sheetUpdateResults
  } = useSheetUpdater();

  const { 
    filteredLibraries, 
    getCollectionsForLibrary, 
    fetchLibraryData, 
    isLoading 
  } = useLibraries(libraries as unknown as Library[], collections);

  const { 
    videos, 
    sortedVideos,
    selectedVideos, 
    setSelectedVideos,
    selectAll, 
    setSelectAll,
    lastCheckedIndex,
    setLastCheckedIndex,
    copiedStates, 
    setCopiedStates,
    loading,
    error,
    getEmbedCode, 
    copySelectedVideos,
    handleCheckboxChange,
    downloadVideo
  } = useVideos(selectedLibrary, selectedCollection);

  const {
    selectedFiles,
    setSelectedFiles,
    autoUploadFiles,
    setAutoUploadFiles,
    uploadInProgress,
    isUploading,
    isAutoUploading,
    showUploadReport,
    uploadResults,
    uploadDuration,
    handleAutoUploadSelect,
    handleManualUploadSelect,
    removeSelectedFile,
    removeAutoUploadFile,
    startAutoUpload,
    startManualUpload,
    setShowUploadReport
  } = useFileUploader(uploadManagerRef, selectedLibrary, selectedCollection, selectedYear);

  const { handleMetadataUpdate } = useUploadQueue(uploadManagerRef);

  const { 
    showSheetUpdateReport, 
    setShowSheetUpdateReport,
    sheetUpdateResults: sheetUpdateOnlyResults,
    sheetUpdateStats,
    sheetUpdateMessage,
    refreshSheetUpdateStatus,
    openSheetUpdateReport
  } = useSheetUpdateReportManager(uploadManagerRef);

  // Initialize upload manager
  useEffect(() => {
    uploadManagerRef.current = new UploadManager(
      (groups) => {
        const componentGroups = groups.map(group => ({
          ...group
        })) as unknown as ComponentUploadGroup[];
        
        setUploadGroups(componentGroups);
      },
      (videoTitle: string, videoGuid: string, libraryId: string) => {
        console.log(`[VideoProcessingForm] Video uploaded callback: ${videoTitle}`);
        updateSheetForVideo(videoTitle, videoGuid, libraryId);
      }
    );

    // For debugging - expose the upload manager ref
    if (typeof window !== 'undefined') {
      (window as any).__uploadManagerRef = uploadManagerRef;
    }

    return () => {
      // Clean up the global reference on unmount
      if (typeof window !== 'undefined') {
        delete (window as any).__uploadManagerRef;
      }
    };
  }, [updateSheetForVideo]);

  // Apply upload settings
  useEffect(() => {
    if (uploadManagerRef.current) {
      uploadManagerRef.current.setUploadSettings(uploadSettings);
    }
  }, [uploadSettings]);

  // Load saved settings on startup
  useEffect(() => {
    const savedSettings = localStorage.getItem('upload_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setUploadSettings(parsedSettings);
      } catch (e) {
        console.error('Error loading saved upload settings:', e);
      }
    }
  }, []);

  // Fetch videos when library/collection changes
  useEffect(() => {
    if (selectedLibrary && selectedCollection) {
      // The hook will automatically fetch videos when selectedLibrary or selectedCollection changes
      // No need to call fetchVideos manually
    }
  }, [selectedLibrary, selectedCollection]);

  // Debug upload results changes with clearer logging
  useEffect(() => {
    console.log("Upload results or report state changed:", {
      resultsCount: uploadResults.length,
      showReport: showUploadReport,
      isAutoUploading,
      isUploading
    });
  }, [uploadResults, showUploadReport, isAutoUploading, isUploading]);

  // Modify the effect that forces the report to show
  useEffect(() => {
    if (uploadResults.length > 0 && !showUploadReport && !reportShownRef.current) {
      console.log("Force showing upload report as results exist but report is hidden");
      setShowUploadReport(true);
      reportShownRef.current = true; // Mark as shown
    }
  }, [uploadResults, showUploadReport]);

  // Reset the ref when results change
  useEffect(() => {
    if (uploadResults.length > 0) {
      reportShownRef.current = false;
    }
  }, [uploadResults]);

  // Handle settings changes
  const handleSettingsChange = (newSettings) => {
    setUploadSettings(newSettings);
    
    localStorage.setItem('upload_settings', JSON.stringify(newSettings));
    
    toast({
      title: "✅ Settings Updated",
      description: "New upload settings will be applied to future uploads.",
      variant: "success",
      duration: 3000
    });
  };

  // Toggle global pause state
  const handleGlobalPauseToggle = useCallback(() => {
    const newState = !isGloballyPaused;
    setIsGloballyPaused(newState);
    uploadManagerRef.current?.toggleGlobalPause();
    toast({
        title: newState ? "⏸️ Uploads Paused" : "▶️ Uploads Resumed",
        description: newState ? "All active uploads have been paused." : "Uploads will resume shortly.",
        variant: "default"
    });
  }, [isGloballyPaused, toast]);

  // Export bandwidth statistics
  const handleExportBandwidth = async () => {
    setIsExporting(true);
    try {
      await bunnyService.getBandwidthStats();
      
      toast({
        title: "✅ Export Complete",
        description: "Bandwidth statistics have been downloaded.",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "❌ Export Failed",
        description: error instanceof Error ? error.message : "Failed to export statistics.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Modify the onClose function to prevent immediate re-opening
  const handleReportClose = () => {
    reportShownRef.current = true; // Mark that we've explicitly closed this report
    setShowUploadReport(false);
  };

  return (
    <Card className="w-full p-6 bg-white space-y-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="space-y-1 animate-slide-in">
          <h2 className="text-2xl font-semibold tracking-tight">Video Processing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your video library and process uploads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGlobalPauseToggle}
            className={cn(
              "hover-lift",
              isGloballyPaused ? "bg-yellow-50 text-yellow-700 border-yellow-300" : ""
            )}
          >
            {isGloballyPaused ? "Resume All" : "Pause All"}
          </Button>
        </div>
      </div>

      <ToolbarSection 
        isExporting={isExporting} 
        isLoading={isLoading}
        onExportBandwidth={handleExportBandwidth}
        onFetchLibraryData={fetchLibraryData}
        uploadSettings={uploadSettings}
        onSettingsChange={handleSettingsChange}
      />

      {/* Automatic Upload Section - Fix props */}
      <div className="hover-lift glass-effect p-4 rounded-lg">
        <AutomaticUploadSection
          autoUploadFiles={autoUploadFiles}
          onFileSelect={handleAutoUploadSelect}
          onStartUpload={startAutoUpload}
          onRemoveFile={removeAutoUploadFile}
          isAutoUploading={isAutoUploading}
          uploadInProgress={uploadInProgress && !isAutoUploading}
        />
      </div>

      {/* Processing Queue Section - Fix props */}
      {uploadGroups.length > 0 && (
        <div className="hover-lift glass-effect p-4 rounded-lg">
          <ProcessingQueueSection
            uploadGroups={uploadGroups}
            libraries={filteredLibraries}
            onUpdateMetadata={handleMetadataUpdate}
            onPauseUpload={(fileId) => uploadManagerRef.current?.pauseUpload(fileId)}
            onResumeUpload={(fileId) => uploadManagerRef.current?.resumeUpload(fileId)}
            onCancelUpload={(fileId) => uploadManagerRef.current?.cancelUpload(fileId)}
            onGlobalPauseToggle={handleGlobalPauseToggle}
            isGloballyPaused={isGloballyPaused}
          />
        </div>
      )}

      {/* Library Settings & Manual Upload */}
      <div className="hover-lift glass-effect p-4 rounded-lg">
        <LibrarySettings 
          libraries={filteredLibraries}
          collections={getCollectionsForLibrary(selectedLibrary)}
          selectedLibrary={selectedLibrary}
          selectedCollection={selectedCollection}
          selectedYear={selectedYear}
          onLibraryChange={onLibraryChange}
          onCollectionChange={onCollectionChange}
          onYearChange={onYearChange}
          isUploading={isUploading}
          selectedFiles={selectedFiles}
          uploadInProgress={uploadInProgress}
          onFileSelect={handleManualUploadSelect}
          onStartUpload={startManualUpload}
          onRemoveFile={removeSelectedFile}
        />
      </div>

      {/* Manual Upload Section with Loading State Fix */}
      <div className="hover-lift glass-effect p-4 rounded-lg">
        <VideoManagementSection
          videos={sortedVideos}
          selectedVideos={selectedVideos}
          selectAll={selectAll}
          onCheckboxChange={handleCheckboxChange}
          onSelectAll={() => {
            setSelectAll(!selectAll);
            setSelectedVideos(prevSelected => {
              const newSet = new Set(prevSelected);
              if (selectAll) {
                newSet.clear();
              } else {
                sortedVideos.forEach(v => newSet.add(v.guid));
              }
              return newSet;
            });
          }}
          copiedStates={copiedStates}
          onCopySelected={copySelectedVideos}
          onUpdateSheet={() => handleUpdateSheet(selectedVideos, sortedVideos, selectedLibrary)}
          onUpdateFinalMinutes={() => handleUpdateFinalMinutes(selectedVideos, sortedVideos, selectedLibrary)}
          isUpdatingSheet={isUpdatingSheet}
          isUpdatingFinalMinutes={isUpdatingFinalMinutes}
          onGetEmbedCode={getEmbedCode}
          onDownloadVideo={downloadVideo}
          selectedLibrary={selectedLibrary}
          loading={loading}
          error={error}
          selectedFiles={selectedFiles}
          onRemoveFile={removeSelectedFile}
          uploadInProgress={uploadInProgress}
          onStartUpload={startManualUpload}
          isUploading={isUploading}
        />
      </div>
      
      {/* Upload Report Dialog - Modified to use our new close handler */}
      <UploadReport 
        open={showUploadReport}
        onClose={handleReportClose}
        results={uploadResults.map(r => ({ 
          id: r.filename,
          filename: r.filename,
          status: r.status === 'completed' ? 'success' : r.status === 'error' ? 'error' : 'skipped',
          message: r.message,
          library: r.library,
          collection: r.collection,
          details: r.details
        }))}
        duration={uploadDuration}
        totalSize={uploadResults.reduce((acc, r) => acc + (r.details?.size || 0), 0)}
        totalUploadedSize={uploadResults.reduce((acc, r) => acc + (r.details?.uploadedSize || 0), 0)}
        totalUploadSpeed={uploadResults.reduce((acc, r) => acc + (r.details?.uploadSpeed || 0), 0)}
        waitForSheetUpdates={false}
      />
      
      {/* Regular Sheet Update Report (for manual updates) */}
      <SheetUpdateReport
        open={sheetUpdateResults.open}
        onClose={() => sheetUpdateResults.setOpen(false)}
        results={sheetUpdateResults.results}
        stats={sheetUpdateResults.stats}
        message={sheetUpdateResults.message}
      />
      
      {/* Sheet Update Only Report (for background updates) */}
      <SheetUpdateOnlyReport
        open={showSheetUpdateReport}
        onClose={() => setShowSheetUpdateReport(false)}
        results={sheetUpdateOnlyResults}
        stats={sheetUpdateStats}
        message={sheetUpdateMessage}
      />
      
      {/* Buttons to show reports - Updated to use the tracked ref */}
      <div className="flex gap-2 mt-4">
        {uploadResults.length > 0 && (
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => {
              console.log("Manually showing upload report");
              reportShownRef.current = false; // Reset the ref when manually showing
              setShowUploadReport(true);
            }}
          >
            <FileCheck className="w-4 h-4 mr-2" />
            عرض تقرير الرفع
          </Button>
        )}
        
        {sheetUpdateOnlyResults.length > 0 && (
          <Button
            variant="outline"
            className="ml-2"
            onClick={openSheetUpdateReport}
          >
            <FileCheck className="w-4 h-4 mr-2" />
            عرض حالة تحديث الجداول
          </Button>
        )}
      </div>
    </Card>
  );
};

export default VideoProcessingForm;
