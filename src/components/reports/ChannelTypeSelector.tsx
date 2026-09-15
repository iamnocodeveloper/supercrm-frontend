import React from 'react';
import { MessageSquare, Phone, Send, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChannelType } from '@/services/reportsService';

interface ChannelTypeSelectorProps {
  selectedChannel: ChannelType;
  onSelect: (channel: ChannelType) => void;
  sessionCounts?: Record<ChannelType, number>;
}

const channels: { id: ChannelType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'whatsapp', label: 'WhatsApp WAHA', icon: MessageSquare },
  { id: 'twilio', label: 'Twilio', icon: Phone },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'webchat', label: 'Webchat', icon: Globe },
];

export const ChannelTypeSelector: React.FC<ChannelTypeSelectorProps> = ({
  selectedChannel,
  onSelect,
  sessionCounts = {}
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map(channel => {
        const Icon = channel.icon;
        const count = sessionCounts[channel.id] || 0;
        const isSelected = selectedChannel === channel.id;

        return (
          <button
            key={channel.id}
            onClick={() => onSelect(channel.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card text-card-foreground border-border hover:bg-accent hover:border-accent"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="font-medium">{channel.label}</span>
            {count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                isSelected
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
