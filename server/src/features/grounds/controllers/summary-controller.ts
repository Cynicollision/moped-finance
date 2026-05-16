import { OperationResult } from '@shared/common/contracts';
import { GroundsSummary } from '@shared/grounds/contracts';
import { LanguageModelGateway } from '@core/interfaces';
import { AppLogger } from '@core/logger';
import { ResultUtil } from '@core/utility';
import { IWeatherGateway } from './../gateways/weather-gateway';

export class SummaryController {
    constructor(
        private logger: AppLogger,
        private languageModelGateway: LanguageModelGateway,
        private weatherGateway: IWeatherGateway
    ) {
    }

    public async getGroundsSummary(userId: string): Promise<OperationResult<GroundsSummary>> {
        const summary: GroundsSummary = {};

        const forecast = await this.weatherGateway.getForecast();
        summary.todaysShortForecast = forecast.properties.periods[0].shortForecast;
        summary.todaysDetailedForecast = forecast.properties.periods[0].detailedForecast;

        const rainDataPromptContext = forecast.properties.periods.map(period => {
            const chanceOfRain = period.probabilityOfPrecipitation?.value ?? 0;
            return `${period.name}: ${chanceOfRain}% chance of rain.`;
        }).join('\n');

        const rainSummaryPrompt = `Summarize the following rain forecast data into 1-2 sentences for purposes of lawn and garden maintenance to let them know when they should expect rain and if they should water their plants/lawn: \n${rainDataPromptContext}`;

        const rainSummary = await this.languageModelGateway.generateText(rainSummaryPrompt);
        summary.rainSummary = rainSummary;
        return ResultUtil.success(summary);
    }
}
