import React from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Copy, CheckCircle2, Save, Loader2, Video, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useToast } from '../../hooks/use-toast';
import { BunnyDownloadService } from '../../lib/bunny/services/download-service';

interface VideoManagementSectionProps {
  videos: any[];
  selectedVideos: Set<string>;
  selectAll: boolean;
  copiedStates: {[key: string]: boolean};
  isUpdatingSheet: boolean;
  isUpdatingFinalMinutes?: boolean;
  loading?: boolean; // Add loading prop
  error?: string; // Add error prop for completeness
  selectedLibrary: string; // Add selectedLibrary prop
  onSelectAll: () => void;
  onCopySelected: () => Promise<void>;
  onUpdateSheet: () => Promise<void>;
  onUpdateFinalMinutes: () => Promise<void>;
  onCheckboxChange: (videoGuid: string, index: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  onGetEmbedCode: (videoGuid: string, videoTitle: string) => Promise<void>;
  onDownloadVideo: (videoGuid: string, videoTitle: string, quality: string) => void; // Add download handler
  selectedFiles?: File[]; // Add missing props that are being passed
  onRemoveFile?: (index: number) => void;
  uploadInProgress?: boolean;
  onStartUpload?: () => Promise<void>;
  isUploading?: boolean;
}

const VideoManagementSection: React.FC<VideoManagementSectionProps> = ({
  videos,
  selectedVideos,
  selectAll,
  copiedStates,
  isUpdatingSheet,
  isUpdatingFinalMinutes = false,
  loading,
  error,
  selectedLibrary, // Add selectedLibrary to destructuring
  onSelectAll,
  onCopySelected,
  onUpdateSheet,
  onUpdateFinalMinutes,
  onCheckboxChange,
  onGetEmbedCode,
  onDownloadVideo, // Add the download handler
  selectedFiles,
  onRemoveFile,
  uploadInProgress,
  onStartUpload,
  isUploading
}) => {
  const { toast } = useToast();
  
  // Enhanced download handler with better error handling
  const handleDownloadVideo = async (videoGuid: string, videoTitle: string, quality: string) => {
    try {
      toast({
        title: "🔄 جاري التحضير للتحميل",
        description: `يتم فحص إمكانية تحميل ${videoTitle} بجودة ${quality}...`,
        variant: "default"
      });

      if (!selectedLibrary) {
        throw new Error('لا توجد مكتبة محددة للتحميل');
      }

      // First check if video can be downloaded
      const downloadInfo = await BunnyDownloadService.getVideoDownloadInfo(
        videoGuid,
        selectedLibrary
      );

      if (!downloadInfo.canDownload) {
        toast({
          title: "❌ لا يمكن تحميل هذا الفيديو",
          description: downloadInfo.errorMessage || "الفيديو لا يدعم التحميل المباشر",
          variant: "destructive",
          duration: 10000
        });

        // Show helpful tip after error
        setTimeout(() => {
          toast({
            title: "💡 نصيحة",
            description: "لتحميل الفيديوهات الجديدة، يجب تفعيل MP4 Fallback في إعدادات المكتبة قبل رفع الفيديوهات.",
            variant: "default",
            duration: 8000
          });
        }, 2000);
        return;
      }

      // Check if requested quality is available
      if (!downloadInfo.availableQualities.includes(quality)) {
        const suggestedQuality = downloadInfo.availableQualities[0];
        if (suggestedQuality) {
          toast({
            title: "⚠️ الجودة غير متاحة",
            description: `جودة ${quality} غير متاحة. سيتم التحميل بجودة ${suggestedQuality}`,
            variant: "warning"
          });
          quality = suggestedQuality;
        } else {
          throw new Error('لا توجد جودات متاحة للتحميل');
        }
      }

      toast({
        title: "⬇️ بدء التحميل",
        description: `تم بدء تحميل ${videoTitle} بجودة ${quality}...`,
        variant: "default"
      });

      // Start download with progress tracking
      await BunnyDownloadService.downloadVideo(
        videoGuid,
        selectedLibrary,
        videoTitle,
        quality,
        undefined,
        (progress) => {
          if (progress > 0 && progress % 25 === 0) { // Show progress every 25%
            console.log(`Download progress: ${progress.toFixed(1)}%`);
          }
        }
      );

      toast({
        title: "✅ تم بدء التحميل بنجاح",
        description: `${videoTitle} - تحقق من مجلد التحميلات`,
        variant: "success"
      });

    } catch (error) {
      console.error('Download failed:', error);
      
      let errorMessage = 'حدث خطأ غير معروف';
      let troubleshootingTip = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('MP4 Fallback')) {
          troubleshootingTip = 'يجب تفعيل MP4 Fallback في إعدادات المكتبة قبل رفع الفيديوهات الجديدة.';
        } else if (errorMessage.includes('غير متاحة')) {
          troubleshootingTip = 'جرب جودة أخرى أو تأكد من أن الفيديو تم معالجته بالكامل.';
        } else if (errorMessage.includes('suspended') || errorMessage.includes('معلق')) {
          troubleshootingTip = 'يبدو أن نطاق CDN معلق. تواصل مع الدعم الفني.';
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          troubleshootingTip = 'الفيديو قد يكون محذوف أو لم تكتمل معالجته بعد.';
        } else {
          troubleshootingTip = 'جرب تحديث الصفحة أو تواصل مع الدعم الفني.';
        }
      }

      toast({
        title: "❌ فشل التحميل",
        description: errorMessage,
        variant: "destructive",
        duration: 12000
      });

      // Show troubleshooting tip
      if (troubleshootingTip) {
        setTimeout(() => {
          toast({
            title: "💡 نصيحة للحل",
            description: troubleshootingTip,
            variant: "default",
            duration: 10000
          });
        }, 2000);
      }
    }
  };

  // Add available qualities for the dropdown
  const availableQualities = ['240p', '360p', '480p', '720p', '1080p', '1440p'];

  return (
    <section className="space-y-4 pt-6 border-t">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6 text-blue-500 animate-pulse-slow" />
          <h3 className="text-lg font-semibold">Video Management</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            disabled={videos.length === 0} // Disable if no videos
            className="hover-lift"
          >
            {selectAll ? 'Deselect All' : 'Select All'} ({videos.length})
          </Button>
          <Button
            onClick={onCopySelected}
            disabled={selectedVideos.size === 0}
            size="sm"
            className="hover-lift"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Selected ({selectedVideos.size})
          </Button>
          <Button
            onClick={onUpdateSheet}
            disabled={selectedVideos.size === 0 || isUpdatingSheet}
            size="sm"
            className="hover-lift"
          >
            {isUpdatingSheet ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Update Sheet
          </Button>
          <Button
            onClick={onUpdateFinalMinutes}
            disabled={selectedVideos.size === 0 || isUpdatingFinalMinutes}
            size="sm"
            variant="secondary"
            className="hover-lift"
          >
            {isUpdatingFinalMinutes ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Update Final Minutes
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-500 mt-2 flex items-center gap-2 animate-fade-in">
        <span className="text-blue-500">💡</span> Tip: Hold Shift while clicking checkboxes to select multiple videos at once.
      </div>

      <ScrollArea className="h-[400px] border rounded-md shadow-inner">
        <div className="p-2 space-y-2">
          {loading && (
            <div className="text-center text-gray-500 py-10 animate-fade-in">
              <Video className="h-12 w-12 mx-auto mb-2 text-gray-300 animate-spin" />
              <p>Loading videos...</p>
            </div>
          )}
          {!loading && videos.length === 0 && (
              <div className="text-center text-gray-500 py-10 animate-fade-in">
                <Video className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No videos found in this collection.</p>
              </div>
          )}
          {!loading && videos.map((video, index) => (
            <div
              key={video.guid}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 transition-all duration-200 hover-lift animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedVideos.has(video.guid)}
                  onChange={(e) => onCheckboxChange(video.guid, index, e)}
                  className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="break-words pr-4 flex-1 font-medium" title={video.title}>{video.title}</span>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Download dropdown button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 px-2 hover:bg-green-50"
                      title="تحميل الفيديو"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>اختر جودة التحميل</DropdownMenuLabel>
                    {availableQualities.map((quality) => (
                      <DropdownMenuItem 
                        key={quality}
                        onClick={() => handleDownloadVideo(video.guid, video.title, quality)}
                        className="cursor-pointer"
                      >
                        📥 {quality}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Existing Copy Embed Code button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGetEmbedCode(video.guid, video.title)}
                  className="flex-shrink-0 px-2 hover:bg-blue-50"
                  title={copiedStates[video.guid] ? "Copied!" : "Copy Embed Code"}
                >
                  {copiedStates[video.guid] ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
};

export default VideoManagementSection;
