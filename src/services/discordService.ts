interface DiscordMessage {
    embeds: Array<{
        title: string;
        description: string;
        color: number;
        timestamp: string;
        fields: Array<{
            name: string;
            value: string;
            inline?: boolean;
        }>;
    }>;
}

class DiscordService {
    private static instance: DiscordService;
    private notificationsEnabled: boolean = true; // Default enabled

    private constructor() {}

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    public setNotificationsEnabled(enabled: boolean): void {
        this.notificationsEnabled = enabled;
    }

    public isNotificationsEnabled(): boolean {
        return this.notificationsEnabled;
    }

    private getWebhookUrl(): string {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
        if (!webhookUrl) {
            console.log('🔇 Missing Discord webhook URL');
        }
        return webhookUrl;
    }

    async sendPersonDetectionAlert(
        userName: string, 
        timestampInitial: Date, 
        timestampFinal: Date,
        frameData?: string
    ): Promise<void> {
        // Check if notifications are enabled
        if (!this.notificationsEnabled) {
            console.log('🔇 Discord notifications are disabled, skipping alert');
            return;
        }

        const webhookUrl = this.getWebhookUrl();
        if (!webhookUrl) {
            return;
        }

        const message: DiscordMessage = {
            embeds: [{
                title: '🚨 Person Detected!',
                description: 'Surveillance system has confirmed a person detection',
                color: 0xff0000, // Red color
                timestamp: timestampFinal.toISOString(),
                fields: [
                    {
                        name: '👤 Detected by',
                        value: userName,
                        inline: false
                    },
                    {
                        name: '🕐 Initial Detection',
                        value: timestampInitial.toLocaleString(),
                        inline: true
                    },
                    {
                        name: '🕐 Final Detection',
                        value: timestampFinal.toLocaleString(),
                        inline: true
                    }
                ]
            }]
        };

        try {
            if (frameData) {
                // Send with image attachment using FormData
                await this.sendWithImage(webhookUrl, message, frameData, userName, timestampFinal);
            } else {
                // Send without image (JSON only)
                await this.sendWithoutImage(webhookUrl, message);
            }
        } catch (error) {
            console.error('❌ Failed to send Discord notification:', error);
        }
    }

    private async sendWithImage(webhookUrl: string, message: DiscordMessage, frameData: string, userName: string, timestamp: Date): Promise<void> {
        // Convert base64 to buffer
        const base64Data = frameData.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Create FormData
        const formData = new FormData();
        
        // Add the JSON payload
        formData.append('payload_json', JSON.stringify(message));
        
        // Add the image file
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('file', blob, `detection_${userName}_${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            console.log('✅ Discord notification with image sent successfully');
        } else {
            console.error('❌ Discord notification with image failed:', response.status, response.statusText);
        }
    }

    private async sendWithoutImage(webhookUrl: string, message: DiscordMessage): Promise<void> {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        if (response.ok) {
            console.log('✅ Discord notification sent successfully');
        } else {
            console.error('❌ Discord notification failed:', response.status, response.statusText);
        }
    }
}

export const discordService = DiscordService.getInstance();