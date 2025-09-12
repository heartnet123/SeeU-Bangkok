"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Minus, 
  Navigation, 
  Layers, 
  Maximize,
  Map as MapIcon
} from 'lucide-react';
import { motion } from 'motion/react';

interface MapControlsProps {
  onStyleChange: (style: 'streets' | 'satellite') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFlyToUserLocation: () => void;
  currentStyle: 'streets' | 'satellite';
  hasUserLocation: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onStyleChange,
  onZoomIn,
  onZoomOut,
  onFlyToUserLocation,
  currentStyle,
  hasUserLocation,
}) => {
  return (
    <motion.div 
      className="absolute top-4 right-4 z-10 flex flex-col gap-2"
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Zoom Controls */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
        <CardContent className="p-1 sm:p-2">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 touch-manipulation"
              title="Zoom In"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <div className="h-px bg-gray-200 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 touch-manipulation"
              title="Zoom Out"
            >
              <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Style Toggle */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
        <CardContent className="p-1 sm:p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStyleChange(currentStyle === 'streets' ? 'satellite' : 'streets')}
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 touch-manipulation"
            title={`Switch to ${currentStyle === 'streets' ? 'Satellite' : 'Street'} View`}
          >
            {currentStyle === 'streets' ? (
              <Layers className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <MapIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </Button>
        </CardContent>
      </Card>

      {/* User Location */}
      {hasUserLocation && (
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-1 sm:p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onFlyToUserLocation}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 touch-manipulation"
              title="Go to My Location"
            >
              <Navigation className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen Toggle */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
        <CardContent className="p-1 sm:p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 touch-manipulation"
            title="Toggle Fullscreen"
          >
            <Maximize className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};