/**
 * Lazy effect-recipe components keyed by id, without metadata: the lightest way for a client component to mount a
 * recipe whose metadata it already has — for example passed as props from a server component that read `./meta`.
 * Each loader is a separate chunk, fetched only when called. (`./registry` pairs the same imports with every recipe's
 * metadata, which a client bundle then carries in full.)
 */
export { effectLoaders } from './effect-loaders.generated';
