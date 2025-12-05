import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { documentAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface DocumentUploadProps {
  onUploadSuccess: () => void;
}

export const DocumentUpload = ({ onUploadSuccess }: DocumentUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      await documentAPI.upload(file);
      toast({
        title: 'Upload successful!',
        description: `${file.name} has been uploaded and is ready to use.`,
      });
      onUploadSuccess();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.response?.data?.message || 'Could not upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        glass rounded-xl p-12 border-2 border-dashed cursor-pointer
        transition-all duration-300 text-center
        ${isDragActive ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border hover:border-primary/50'}
        ${uploading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-4">
        {uploading ? (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Uploading...</p>
            <p className="text-sm text-muted-foreground">Processing your document</p>
          </>
        ) : (
          <>
            <div className="relative">
              <motion.div
                animate={{
                  y: isDragActive ? -10 : 0,
                }}
                transition={{ duration: 0.2 }}
              >
                <Upload className="w-12 h-12 text-primary" />
              </motion.div>
              <motion.div
                animate={{
                  scale: isDragActive ? 1.2 : 1,
                  opacity: isDragActive ? 1 : 0.5,
                }}
                className="absolute -inset-4 bg-primary/20 rounded-full blur-xl -z-10"
              />
            </div>

            <div>
              <p className="text-lg font-medium mb-1">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your document'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>PDF, DOCX, PPTX • Max 10MB</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
