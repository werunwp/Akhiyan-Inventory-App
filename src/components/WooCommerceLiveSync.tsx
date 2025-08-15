import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RotateCw, Clock, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useLiveSyncSettings, useSyncLogs, useManualSync } from "@/hooks/useWooCommerceLiveSync";
import { formatDistanceToNow } from "date-fns";

interface WooCommerceLiveSyncProps {
  connectionId: string;
  siteName: string;
}

export const WooCommerceLiveSync = ({ connectionId, siteName }: WooCommerceLiveSyncProps) => {
  const [syncInterval, setSyncInterval] = useState(60);
  const [syncIntervalUnit, setSyncIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [syncTime, setSyncTime] = useState('');
  const [isActiveSync, setIsActiveSync] = useState(false);

  const {
    settings,
    isLoading: settingsLoading,
    createSettings,
    updateSettings,
    isCreating,
    isUpdating,
  } = useLiveSyncSettings(connectionId);

  const { data: syncLogs } = useSyncLogs(connectionId);
  const { startSync, isSyncing } = useManualSync();

  const handleSaveSettings = () => {
    const intervalInMinutes = syncIntervalUnit === 'hours' 
      ? syncInterval * 60 
      : syncIntervalUnit === 'days' 
      ? syncInterval * 24 * 60 
      : syncInterval;

    const settingsData = {
      connection_id: connectionId,
      is_active: isActiveSync,
      sync_interval_minutes: intervalInMinutes,
      sync_time: syncTime || null,
    };

    if (settings) {
      updateSettings({ id: settings.id, ...settingsData });
    } else {
      createSettings(settingsData);
    }
  };

  const handleManualSync = () => {
    startSync(connectionId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  React.useEffect(() => {
    if (settings) {
      setIsActiveSync(settings.is_active);
      
      // Convert minutes back to appropriate unit
      const minutes = settings.sync_interval_minutes;
      if (minutes >= 1440) { // days
        setSyncInterval(Math.floor(minutes / 1440));
        setSyncIntervalUnit('days');
      } else if (minutes >= 60) { // hours
        setSyncInterval(Math.floor(minutes / 60));
        setSyncIntervalUnit('hours');
      } else {
        setSyncInterval(minutes);
        setSyncIntervalUnit('minutes');
      }
      
      setSyncTime(settings.sync_time || '');
    }
  }, [settings]);

  if (settingsLoading) {
    return <div>Loading sync settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCw className="h-5 w-5" />
          Live Sync Products - {siteName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Interval</Label>
            <div className="flex gap-2">
              <Input
                id="sync-interval"
                type="number"
                min="1"
                value={syncInterval}
                onChange={(e) => setSyncInterval(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <Select value={syncIntervalUnit} onValueChange={(value: 'minutes' | 'hours' | 'days') => setSyncIntervalUnit(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-time">Specific Time (Optional)</Label>
            <Input
              id="sync-time"
              type="time"
              value={syncTime}
              onChange={(e) => setSyncTime(e.target.value)}
              placeholder="HH:MM"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="active-sync">Enable Live Sync</Label>
            <p className="text-sm text-muted-foreground">
              Automatically sync products between WooCommerce and your app
            </p>
          </div>
          <Switch
            id="active-sync"
            checked={isActiveSync}
            onCheckedChange={setIsActiveSync}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleSaveSettings} 
            disabled={isCreating || isUpdating}
            className="flex-1"
          >
            {isCreating || isUpdating ? "Saving..." : "Save Sync Settings"}
          </Button>
          <Button 
            onClick={handleManualSync} 
            disabled={isSyncing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Recent Sync History</h4>
          {syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(log.status)}>
                          {log.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline">
                          {log.sync_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(log.started_at))} ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {log.status === 'completed' && (
                      <div className="space-y-1">
                        <p className="text-green-600">
                          {log.products_created} created, {log.products_updated} updated
                        </p>
                        {log.products_failed > 0 && (
                          <p className="text-red-600">{log.products_failed} failed</p>
                        )}
                      </div>
                    )}
                    {log.status === 'failed' && log.error_message && (
                      <p className="text-red-600 max-w-xs truncate">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No sync history available</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};