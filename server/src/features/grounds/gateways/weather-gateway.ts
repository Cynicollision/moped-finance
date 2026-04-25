export interface NWSForecastResponse {
    properties: {
        updated: string;
        periods: NWSForecastPeriod[];
    }
}

export interface NWSForecastPeriod {
    number: number;
    name: string;
    startTime: string;
    endTime: string;
    isDaytime: boolean;
    temperature: number;
    temperatureUnit: string;
    temperatureTrend: string | null;
    probabilityOfPrecipitation: {
        unitCode: string;
        value: number | null;
    };
    windSpeed: string;
    windDirection: string;
    icon: string;
    shortForecast: string;
    detailedForecast: string;
}

export interface IWeatherGateway {
    getForecast(): Promise<NWSForecastResponse>;
    getHourlyForecast(): Promise<NWSForecastResponse>;
}

export class WeatherGateway implements IWeatherGateway {
    constructor(
        private office: string,
        private gridX: number,
        private gridY: number,
        private baseUrl: string,
        private userAgent: string
    ) {
        if (!office || gridX === undefined || gridY === undefined || !baseUrl || !userAgent) {
            console.warn('WeatherGateway: NWS missing config, API calls will fail.');
        }
    }

    public static fromEnvironment(): WeatherGateway {
        const office = process.env.NWS_OFFICE || '';
        const gridX = parseInt(process.env.NWS_GRID_X || '0', 10);
        const gridY = parseInt(process.env.NWS_GRID_Y || '0', 10);
        const baseUrl = process.env.NWS_BASE_URL || 'https://api.weather.gov';
        const userAgent = process.env.NWS_USER_AGENT || 'HomeLab (your_email@example.com)';

        return new WeatherGateway(office, gridX, gridY, baseUrl, userAgent);
    }

    public async getForecast(): Promise<NWSForecastResponse> {
        if (!this.office || !this.gridX || !this.gridY) {
            throw new Error('WeatherGateway is missing required grid configuration.');
        }

        const url = `${this.baseUrl}/gridpoints/${this.office}/${this.gridX},${this.gridY}/forecast`;

        return this.fetchFromNWS<NWSForecastResponse>(url);
    }

    public async getHourlyForecast(): Promise<NWSForecastResponse> {
        if (!this.office || !this.gridX || !this.gridY) {
            throw new Error('WeatherGateway is missing required grid configuration.');
        }

        const url = `${this.baseUrl}/gridpoints/${this.office}/${this.gridX},${this.gridY}/forecast/hourly`;

        return this.fetchFromNWS<NWSForecastResponse>(url);
    }

    private async fetchFromNWS<T>(url: string): Promise<T> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`NWS API error! status: ${response.status}, message: ${errorText}`);
            }

            return await response.json() as T;
        }
        catch (error) {
            console.error(`Error requesting NWS API (${url}):`, error);
            throw error;
        }
    }
}
