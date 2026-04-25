import { Router, Request, Response } from 'express';
import { CareTask, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { ApiHandler } from './api-handler';
import { AppLogger } from './../core/logger';
import { GeminiGateway } from './../core/gateways/gemini-gateway';
import { GroundsController } from './../features/grounds-controller';
import { GroundsData } from './../features/grounds/data';
import { WeatherGateway } from './../features/grounds/gateways/weather-gateway';

const router = Router();

const logger = AppLogger.fromEnvironment();
const groundsData = GroundsData.forPgDatabase();
const llmGateway = GeminiGateway.fromEnvironment();
const weatherGateway = WeatherGateway.fromEnvironment();
const controller = new GroundsController(groundsData, llmGateway, weatherGateway);
const handler = new ApiHandler(logger);

router.get('/summary', (req, res) => {
    handler.execute(req, res, 'getGroundsSummary', (context) => {
        return controller.getGroundsSummary(context.userId!);
    });
});

router.get('/data/locations', (req, res) => {
    handler.execute(req, res, 'getLocations', (context) => {
        return controller.getLocations(context.userId!);
    });
});

router.get('/data/plants', (req, res) => {
    handler.execute(req, res, 'getPlants', (context) => {
        const varietyId = req.query.varietyId as string;
        return controller.getPlants(context.userId!, varietyId);
    });
});

router.get('/data/plant-varieties', (req, res) => {
    handler.execute(req, res, 'getPlantVarieties', (context) => {
        return controller.getPlantVarieties(context.userId!);
    });
});

router.get('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'getPlantVariety', (context) => {
        return controller.getPlantVariety(context.userId!, req.params.id);
    });
});

router.put('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'savePlantData', (context) => {
        const requestBody = req.body;
        const variety: PlantVariety = requestBody.variety;
        const plants: Plant[] = requestBody.plants || [];

        variety.id = req.params.id; // ensure ID from URL param overrides body
        return controller.savePlantData(context.userId!, variety, plants);
    });
});

router.get('/data/products', (req, res) => {
    handler.execute(req, res, 'getProducts', (context) => {
        return controller.getProducts(context.userId!);
    });
});

router.get('/data/products/:id', (req, res) => {
    handler.execute(req, res, 'getProduct', (context) => {
        return controller.getProduct(context.userId!, req.params.id);
    });
});

router.post('/data/products', (req, res) => {
    handler.execute(req, res, 'createProduct', (context) => {
        return controller.createProduct(context.userId!, req.body);
    });
});

router.put('/data/products/:id', (req, res) => {
    handler.execute(req, res, 'saveProduct', (context) => {
        const product: Product = req.body;
        product.id = req.params.id; // ensure ID from URL param overrides body
        return controller.saveProduct(context.userId!, product);
    });
});

router.delete('/data/products/:id', (req, res) => {
    handler.execute(req, res, 'deleteProduct', (context) => {
        return controller.deleteProduct(context.userId!, req.params.id);
    });
});

router.get('/data/tasks', (req, res) => {
    handler.execute(req, res, 'getCareTasks', (context) => {
        const year = (req.query.year as string) || new Date().getFullYear().toString();
        return controller.getCareTasks(context.userId!, year);
    });
});

router.post('/data/tasks', (req, res) => {
    handler.execute(req, res, 'createCareTask', (context) => {
        return controller.createCareTask(context.userId!, req.body);
    });
});

router.put('/data/tasks/:id', (req, res) => {
    handler.execute(req, res, 'saveCareTask', (context) => {
        const task: CareTask = req.body;
        task.id = req.params.id; // ensure ID from URL param overrides body
        return controller.saveCareTask(context.userId!, task);
    });
});

export default router;