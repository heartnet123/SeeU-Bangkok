"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Minus, 
  Navigation, 
  Layers, 
  Maximize,
  Map as MapIcon,
  Box,
  Car,
  Sun,
  Moon,
} from 'lucide-react';
import { motion } from 'motion/react';

interface MapControlsProps {
  onStyleChange: (style: 'dark' | 'light' | 'satellite') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFlyToUserLocation: () => void;
  onToggle3D?: () => void;
  onToggleTraffic?: () => void;
  currentStyle: 'dark' | 'light' | 'satellite';
  hasUserLocation: boolean;
  is3DEnabled?: boolean;
  isTrafficEnabled?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onStyleChange,
  onZoomIn,
  onZoomOut,
  onFlyToUserLocation,
  onToggle3D,
  onToggleTraffic,
  currentStyle,
  hasUserLocation,
  is3DEnabled = false,
  isTrafficEnabled = false,
}) => {
  const isDarkMode = currentStyle === 'dark';
  
  // Cycle through styles: dark -> light -> satellite -> dark
  const handleStyleToggle = () => {
    if (currentStyle === 'dark') {
      onStyleChange('light');
    } else if (currentStyle === 'light') {
      onStyleChange('satellite');
    } else {
      onStyleChange('dark');
    }
  };

  // Get icon and title for current style
  const getStyleInfo = () => {
    switch (currentStyle) {
      case 'dark':
        return { icon: <Moon className="h-4 w-4" />, title: 'Dark Mode (click for Light)' };
      case 'light':
        return { icon: <Sun className="h-4 w-4" />, title: 'Light Mode (click for Satellite)' };
      case 'satellite':
        return { icon: <Layers className="h-4 w-4" />, title: 'Satellite (click for Dark)' };
    }
  };

  const styleInfo = getStyleInfo();

  return (
    <motion.div 
      className="absolute top-4 right-4 z-10 flex flex-col gap-2"
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Zoom Controls */}
      <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
        <CardContent className="p-1 sm:p-1.5">
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-200 hover:bg-gray-700 hover:text-white' 
                  : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
              title="Zoom In"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className={`h-px mx-1.5 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-200 hover:bg-gray-700 hover:text-white' 
                  : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
              title="Zoom Out"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Style Toggle (Dark/Light/Satellite) */}
      <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
        <CardContent className="p-1 sm:p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStyleToggle}
            className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
              currentStyle === 'satellite'
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : isDarkMode
                  ? 'text-gray-200 hover:bg-gray-700 hover:text-white'
                  : 'hover:bg-blue-50 hover:text-blue-600'
            }`}
            title={styleInfo.title}
          >
            {styleInfo.icon}
          </Button>
        </CardContent>
      </Card>

      {/* 3D Toggle */}
      {onToggle3D && (
        <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle3D}
              className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                is3DEnabled 
                  ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                  : isDarkMode
                    ? 'text-gray-200 hover:bg-purple-900/50 hover:text-purple-400'
                    : 'hover:bg-purple-50 hover:text-purple-600'
              }`}
              title={is3DEnabled ? 'Disable 3D Buildings' : 'Enable 3D Buildings'}
            >
              <Box className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Traffic Toggle */}
      {onToggleTraffic && (
        <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTraffic}
              className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isTrafficEnabled 
                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                  : isDarkMode
                    ? 'text-gray-200 hover:bg-orange-900/50 hover:text-orange-400'
                    : 'hover:bg-orange-50 hover:text-orange-600'
              }`}
              title={isTrafficEnabled ? 'Hide Traffic' : 'Show Traffic'}
            >
              <Car className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* User Location */}
      {hasUserLocation && (
        <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onFlyToUserLocation}
              className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-200 hover:bg-gray-700 hover:text-white' 
                  : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
              title="Go to My Location"
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen Toggle */}
      <Card className={`${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-0'} backdrop-blur-md shadow-lg`}>
        <CardContent className="p-1 sm:p-1.5">
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
            className={`h-9 w-9 p-0 touch-manipulation rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-gray-200 hover:bg-gray-700 hover:text-white' 
                : 'hover:bg-blue-50 hover:text-blue-600'
            }`}
            title="Toggle Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
