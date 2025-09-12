'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Upload, X, Loader2, Camera, User } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
  currentImageUrl?: string
  onImageUpload: (url: string) => void
  onImageRemove: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ImageUpload({ 
  currentImageUrl, 
  onImageUpload, 
  onImageRemove, 
  disabled = false,
  size = 'md',
  className = ''
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, or WebP)'
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      return 'Image size must be less than 5MB'
    }

    return null
  }

  const uploadImage = useCallback(async (file: File) => {
    try {
      setUploading(true)

      // Validate file
      const validationError = validateFile(file)
      if (validationError) {
        toast.error(validationError)
        return
      }

      // Check if Supabase client is properly initialized
      if (!supabase) {
        toast.error('Cannot Upload Right Now')
        return
      }

      // Remove current image first if it exists
      if (currentImageUrl && currentImageUrl.includes('supabase')) {
        try {
          const pathParts = currentImageUrl.split('/storage/v1/object/public/user-uploads/')
          if (pathParts.length > 1) {
            const oldPath = pathParts[1]
            console.log('Removing current image before upload:', oldPath)
            await supabase.storage
              .from('user-uploads')
              .remove([oldPath])
            console.log('Current image removed successfully')
          }
        } catch (removeError) {
          console.warn('Failed to remove current image, continuing with upload:', removeError)
          // Continue with upload even if removal fails
        }
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        toast.error(`Upload failed: ${error.message}`)
        return
      }

      if (!data || !data.path) {
        toast.error('Upload failed: No file path returned')
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(data.path)

      if (!publicUrl) {
        console.error('No public URL generated')
        toast.error('Upload failed: Could not generate URL')
        return
      }

      onImageUpload(publicUrl)
      setPreviewUrl(null)
      toast.success('Image uploaded successfully!')

    } catch (error: any) {
      console.error('Upload error details:', {
        message: error.message,
        error: error,
        stack: error.stack
      })
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }, [supabase, onImageUpload, currentImageUrl])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload the file
    uploadImage(file)
  }, [uploadImage])

  const handleRemoveImage = useCallback(async () => {
    try {
      // If there's a current image, try to delete it from storage
      if (currentImageUrl && currentImageUrl.includes('supabase')) {
        const pathParts = currentImageUrl.split('/storage/v1/object/public/user-uploads/')
        if (pathParts.length > 1) {
          const path = pathParts[1]
          await supabase.storage
            .from('user-uploads')
            .remove([path])
        }
      }

      onImageRemove()
      setPreviewUrl(null)
      toast.success('Image removed successfully!')
    } catch (error: any) {
      console.error('Remove error:', error)
      // Still call onImageRemove even if storage deletion fails
      onImageRemove()
      toast.success('Image removed successfully!')
    }
  }, [currentImageUrl, onImageRemove, supabase])

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const displayUrl = previewUrl || currentImageUrl

  return (
    <div className={`space-y-4 ${className}`}>
      <Label className="text-sm font-medium">Profile Picture</Label>
      
      <div className="flex items-center space-x-4">
        {/* Avatar Display */}
        <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
          <div className={`${sizeClasses[size]} rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden`}>
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Profile"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <User className={`${iconSizes[size]} text-gray-400`} />
            )}
          </div>

          {/* Loading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openFileDialog}
            disabled={disabled || uploading}
            className="flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                <span>Change Photo</span>
              </>
            )}
          </Button>

          {displayUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              disabled={disabled || uploading}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
              <span>Remove</span>
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* Upload guidelines */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Supported formats: JPEG, PNG, WebP</p>
        <p>• Maximum file size: 5MB</p>
        <p>• Recommended size: 400x400 pixels</p>
      </div>
    </div>
  )
}