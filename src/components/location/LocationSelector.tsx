import { useState } from "react";
import { MapPin, Navigation, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGeolocation } from "@/hooks/useGeolocation";

interface LocationSelectorProps {
  currentLocation: string;
  onLocationChange: (location: string, coords?: { lat: number; lng: number }) => void;
}

export const LocationSelector = ({ currentLocation, onLocationChange }: LocationSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const { latitude, longitude, loading, error, requestLocation } = useGeolocation();

  const handleUseMyLocation = () => {
    requestLocation();
  };

  // Update location when geolocation succeeds
  const handleGeolocationSuccess = () => {
    if (latitude && longitude) {
      onLocationChange("Current Location", { lat: latitude, lng: longitude });
      setOpen(false);
    }
  };

  const handleZipCodeSubmit = () => {
    if (zipCode.trim()) {
      // In a real app, you'd geocode the zip code here
      onLocationChange(zipCode);
      setOpen(false);
      setZipCode("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <MapPin className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{currentLocation || "Set location"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Change location</p>
            <p className="text-xs text-muted-foreground">
              Enter a zip code or use your current location
            </p>
          </div>

          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={() => {
              handleUseMyLocation();
              if (latitude && longitude) {
                handleGeolocationSuccess();
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Use my current location
          </Button>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-popover px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter zip code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleZipCodeSubmit()}
              className="flex-1"
            />
            <Button onClick={handleZipCodeSubmit} disabled={!zipCode.trim()}>
              Go
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
