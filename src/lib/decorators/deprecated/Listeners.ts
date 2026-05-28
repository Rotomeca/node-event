import { Func, Nullable } from '@rotomeca/utils';
import { JsEvent } from '../../classes/deprecated/JsEvent';
import { JsCircularEvent } from '../../classes/deprecated/JsCircularEvent';

/**
 * Clé Symbol utilisée pour stocker la Map de cache des listeners sur l'instance cible.
 * @internal
 */
const globalCacheKey = Symbol('deprecatedListenersCache');

/**
 * Options internes passées à la fonction helper `_get`.
 * @template T Type de l'instance cible.
 * @template TCallback Type de la fonction de callback de l'événement.
 */
type GetListenerOptions<T, TCallback extends Func> = {
	/** L'instance de la classe contenant l'accesseur décoré. */
	target: T;
	/** La clé unique identifiant la propriété de l'événement dans le cache. */
	listenerCacheKey: symbol;
	/** Fonction d'initialisation optionnelle exécutée à la création de l'événement. */
	initializator?: Nullable<CallbackInitializator<TCallback, T>>;
	/** Si true, instancie un `JsCircularEvent`. */
	circular?: boolean;
};

/**
 * Définit la signature de la fonction d'initialisation d'un événement.
 * Permet de configurer l'événement (ex: ajouter des abonnés par défaut) lors de sa création.
 *
 * @template TCallback Signature de la fonction callback de l'événement.
 * @template This Type de l'instance de la classe parente.
 * @param event L'instance de l'événement nouvellement créée.
 * @param instance L'instance de la classe parente.
 */
type CallbackInitializator<TCallback extends Func, This> = (
	event: JsEvent<TCallback> | JsCircularEvent<TCallback>,
	instance: This,
) => void;

/**
 * Options de configuration pour le décorateur {@link Listener}.
 */
type ListenerDefaultOptions = {
	/**
	 * Si `true` (par défaut), l'événement n'est instancié que lors du premier accès (getter).
	 * Si `false`, l'événement est instancié immédiatement lors de l'initialisation de la classe parente.
	 * @default true
	 */
	lazy?: boolean;
	/**
	 * Si `true`, crée une instance de {@link JsCircularEvent} au lieu de {@link JsEvent}.
	 * Utile pour gérer les dépendances circulaires ou les topologies d'événements complexes.
	 * @default false
	 */
	circular?: boolean;
};

/**
 * Décorateur d'accesseur automatique pour gérer des instances de `JsEvent`.
 *
 * Ce décorateur transforme un accesseur (auto-accessor) en une propriété gérée,
 * assurant une instanciation unique (Singleton par propriété) et une gestion du cache.
 * Il empêche également l'écrasement accidentel de l'événement via le setter.
 *
 * @template TCallback Signature de la fonction callback de l'événement.
 * @template This Type de l'instance de la classe parente.
 *
 * @param initializator - (Optionnel) Fonction exécutée une seule fois à la création de l'événement pour le configurer.
 * @param options - (Optionnel) Configuration du comportement du listener (lazy loading, type d'événement).
 *
 * @returns Le décorateur d'accesseur de classe conforme à la norme ES Decorators (Stage 3).
 *
 * @throws {Error} Si une tentative d'assignation (setter) est effectuée sur la propriété décorée.
 *
 * @example
 * ```ts
 * class MyComponent {
 * @Listener((evt, instance) => evt.attach(instance.handleAction), { lazy: true })
 * accessor onAction: JsEvent<(val: string) => void>;
 *
 *  private handleAction(val: string) {
 *    console.log(val);
 *  }
 * }
 * ```
 * @deprecated Utilisez plutôt {@link event} ou {@link circularEvent}
 */
export function Listener<TCallback extends Func, This = any>(
	initializator?: Nullable<CallbackInitializator<TCallback, This>>,
	options?: ListenerDefaultOptions,
) {
	const { circular = false, lazy = true } = options ?? {};

	return function (
		_target: ClassAccessorDecoratorTarget<This, JsEvent<TCallback>>,
		context: ClassAccessorDecoratorContext<This, JsEvent<TCallback>>,
	): ClassAccessorDecoratorResult<This, JsEvent<TCallback>> {
		const methodName = String(context.name);
		const listenerCacheKey = Symbol(`listener_${methodName}`);
		const args = { listenerCacheKey, circular, initializator };

		if (!lazy) {
			context.addInitializer(function (this: This) {
				_get<This, TCallback>({ target: this, ...args });
			});
		}

		return {
			get(this: This): JsEvent<TCallback> {
				return _get<This, TCallback>({ target: this, ...args });
			},
			set(_value) {
				throw new Error(
					`Cannot set decorated accessor ${String(context.name)}. It is managed by the @Listener decorator.`,
				);
			},
		};
	};
}

/**
 * Helper interne pour récupérer ou créer l'instance de l'événement.
 * Imémente le principe DRY pour le chargement immédiat (eager) et différé (lazy).
 *
 * @template T Type de l'instance cible.
 * @template TCallback Type du callback de l'événement.
 * @param options Objet contenant les paramètres de récupération/création.
 * @returns L'instance de l'événement stockée dans le cache.
 * @throws {Error} Si l'initializator à échoué
 * @internal
 */
function _get<T, TCallback extends Func>(
	options: GetListenerOptions<T, TCallback>,
): JsEvent<TCallback> {
	const { target: self, listenerCacheKey, circular, initializator } = options;

	const cache = ((self as any)[globalCacheKey] ??= new Map<
		Symbol,
		JsEvent<TCallback>
	>());
	if (!cache.has(listenerCacheKey)) {
		const event = circular
			? new JsCircularEvent<TCallback>()
			: new JsEvent<TCallback>();

		if (initializator && initializator.name !== NoInitListener.name) {
			try {
				initializator(event, self);
			} catch (error) {
				throw error;
			}
		}

		cache.set(listenerCacheKey, event);
	}

	return cache.get(listenerCacheKey)!;
}

/**
 * Fonction "No-op" (No Operation) servant de placeholder sémantique.
 *
 * Utilisez cette fonction comme premier argument du décorateur {@link Listener}
 * lorsque vous n'avez aucune logique d'initialisation à fournir, mais que vous
 * devez passer un objet d'options en second argument.
 *
 * Cela améliore la lisibilité du code et l'intention par rapport à l'utilisation de `null` ou `() => {}`.
 *
 * @example
 * ```ts
 * class GraphNode {
 * // On souhaite activer le mode 'circular', sans logique d'initialisation spécifique.
 * @Listener(NoInitListener, { circular: true })
 * accessor links: JsEvent<LinkCallback>;
 * }
 * ```
 * @deprecated Utilisez plutôt {@link NoInitEvent}
 */
export function NoInitListener() {}
