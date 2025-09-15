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

    private constructor() {}

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
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
        timestampFinal: Date
    ): Promise<void> {
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
        } catch (error) {
            console.error('❌ Failed to send Discord notification:', error);
        }
    }
}

export const discordService = DiscordService.getInstance();