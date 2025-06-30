import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Settings, Loader2 } from "lucide-react";
import AdvancedSettings from "./AdvancedSettings";

interface ToolbarSectionProps {
  isExporting: boolean;
  isLoading: boolean;
  onExportBandwidth: () => Promise<void>;
  onFetchLibraryData: () => Promise<void>;
  uploadSettings: {
    chunkSize: number;
    maxConcurrentUploads: number;
    useStreamingUpload: boolean;
    useTusThresholdMB?: number;
    retryAttempts?: number;
    timeoutMs?: number;
    enableAutoRetry?: boolean;
    enableConnectionCheck?: boolean;
    enableResumableSessions?: boolean;
    sessionExpiryHours?: number;
  };
  onSettingsChange: (settings: any) => void;
}

const ToolbarSection = ({
  isExporting,
  isLoading,
  onExportBandwidth,
  onFetchLibraryData,
  uploadSettings,
  onSettingsChange
}: ToolbarSectionProps) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleExportClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isExporting) {
      await onExportBandwidth();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportClick}
          disabled={isExporting}
          className="hover-lift glass-effect"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export Bandwidth Usage
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onFetchLibraryData}
          disabled={isLoading}
          className="hover-lift glass-effect"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Refresh Library Data
            </>
          )}
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowSettings(true)}
        className="hover-lift glass-effect"
      >
        <Settings className="w-4 h-4 mr-2" />
        Upload Settings
      </Button>

      <AdvancedSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={uploadSettings}
        onSettingsChange={onSettingsChange}
      />
    </div>
  );
};

export default ToolbarSection;
