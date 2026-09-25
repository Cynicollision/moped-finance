# Client

Structure and build configurations are described in [docs/architecture.md](../docs/architecture.md#client); test notes are in [docs/testing.md](../docs/testing.md#client).

- Follow the existing screens in `src/app/finance/` for new UI: standalone components, Angular Material, and the shared pieces in `finance/common/` and `core/`.
- API calls go through `core/api.service.ts`; request and response shapes come from `@shared`.
- Demo mode (`core/demo/`) currently answers only auth requests. Don't extend it unless the task asks; that's tracked as APP-4.3.
- Check UI changes in the running app (`npm start`, with the API up), not only through tests.
