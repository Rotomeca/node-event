import { Func, MayBe, Nullable } from '@rotomeca/utils';

/**
 * Représente le résultat d'un appel à un événement.
 *
 * Ce type discriminé permet de distinguer sans ambiguïté les trois cas
 * possibles lors de l'appel des callbacks d'un événement, même si
 * `ReturnType<T>` est lui-même un objet.
 *
 * @typeParam T - Le type du callback, doit étendre {@link Func}.
 *
 * @example
 * ```ts
 * const result = monEvent.call(...args);
 *
 * switch (result.type) {
 *   case 'empty':
 *     // Aucun callback enregistré
 *     break;
 *   case 'single':
 *     console.log(result.value); // ReturnType<T>
 *     break;
 *   case 'multiple':
 *     console.log(result.values); // Record<string, ReturnType<T>>
 *     break;
 * }
 * ```
 */
export type EventCallResult<T extends Func> =
	/** Aucun callback enregistré — l'appel n'a produit aucun résultat. */
	| { type: 'empty' }
	/** Un seul callback enregistré — `value` contient son résultat. */
	| { type: 'single'; value: ReturnType<T> }
	/** Plusieurs callbacks enregistrés — `values` associe chaque clé à son résultat. */
	| { type: 'multiple'; values: Record<string, ReturnType<T>> };

/**
 * Type du callback déclenché lorsqu'un handler est ajouté à un {@link IEventHandler}.
 *
 * Équivalent du pattern
 * [`INotifyCollectionChanged`](https://learn.microsoft.com/fr-fr/dotnet/api/system.collections.specialized.inotifycollectionchanged)
 * en C# pour la notification d'ajout.
 *
 * @typeParam TArgs - Tuple des types d'arguments du handler ajouté. Par défaut `any[]`.
 * @typeParam T - Type du handler ajouté, doit étendre `Func<TArgs>`.
 *               Par défaut `Func<TArgs>`.
 *
 * @param key - La clé sous laquelle le handler a été enregistré.
 * @param callbackAdded - Le handler qui vient d'être ajouté.
 *
 * @example
 * ```ts
 * const onAdded: HandlerAddedCallback<[string], (s: string) => void> =
 *   (key, cb) => console.log(`Handler "${key}" ajouté`);
 *
 * event.onHandlerAdded.push(onAdded);
 * ```
 *
 * @see {@link IEventHandler.onHandlerAdded}
 */
export type HandlerAddedCallback<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
> = (key: string, callbackAdded: T) => void;

/**
 * Type du callback déclenché lorsqu'un handler est retiré d'un {@link IEventHandler}.
 *
 * Équivalent du pattern
 * [`INotifyCollectionChanged`](https://learn.microsoft.com/fr-fr/dotnet/api/system.collections.specialized.inotifycollectionchanged)
 * en C# pour la notification de suppression.
 *
 * @typeParam TArgs - Tuple des types d'arguments du handler retiré. Par défaut `any[]`.
 * @typeParam T - Type du handler retiré, doit étendre `Func<TArgs>`.
 *               Par défaut `Func<TArgs>`.
 *
 * @param key - La clé sous laquelle le handler était enregistré.
 * @param callbackRemoved - Le handler qui vient d'être retiré, si il éxiste.
 *
 * @example
 * ```ts
 * const onRemoved: HandlerRemovedCallback<[string], (s: string) => void> =
 *   (key, cb) => console.log(`Handler "${key}" retiré`);
 *
 * event.onHandlerRemoved.push(onRemoved);
 * ```
 *
 * @see {@link IEventHandler.onHandlerRemoved}
 */
export type HandlerRemovedCallback<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
> = (key: string, callbackRemoved: MayBe<T>) => void;

/**
 * Type du callback déclenché lorsque tous les handlers sont supprimés
 * d'un {@link IEventHandler} via {@link IEventHandler.clear}.
 *
 * Contrairement à {@link HandlerRemovedCallback} qui se déclenche handler
 * par handler, ce callback reçoit en une seule fois la liste complète des
 * handlers supprimés — ce qui permet de réagir à un effacement global
 * sans subir N déclenchements successifs.
 *
 * @typeParam TArgs - Tuple des types d'arguments des handlers supprimés.
 *                    Par défaut `any[]`.
 * @typeParam T - Type des handlers supprimés, doit étendre `Func<TArgs>`.
 *               Par défaut `Func<TArgs>`.
 *
 * @param key - Réservé pour usage futur — vide lors d'un `clear()` global.
 * @param callbacksCleared - La liste de tous les handlers qui viennent
 *                           d'être supprimés.
 *
 * @example
 * ```ts
 * const onCleared: HandlerClearedCallback<[string], (s: string) => void> =
 *   (key, callbacks) => console.log(`${callbacks.length} handler(s) supprimé(s)`);
 *
 * event.onHandlerCleared.push(onCleared);
 * event.clear(); // → "3 handler(s) supprimé(s)"
 * ```
 *
 * @see {@link IEventHandler.onHandlerCleared}
 * @see {@link HandlerRemovedCallback} pour la suppression unitaire
 */
export type HandlerClearedCallback<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
> = (callbacksCleared: T[]) => void;

/**
 * Représente le résultat d'un appel à un {@link CircularEventHandler}.
 *
 * Ce type discriminé permet de distinguer sans ambiguïté les trois cas
 * possibles lors de la propagation circulaire, même si `TRecord` contient
 * des propriétés dont la valeur est un objet imbriqué.
 *
 * @typeParam TRecord - Type du record propagé entre les callbacks,
 *                      doit étendre `Record<string, unknown>`.
 *
 * @example
 * ```ts
 * const result = pipeline.invoke({ count: 0, label: '' });
 *
 * switch (result.type) {
 *   case 'empty':
 *     // Aucun callback enregistré — le record n'a pas été traité
 *     break;
 *   case 'record':
 *     console.log(result.value); // TRecord fusionné après tous les callbacks
 *     break;
 *   case 'other':
 *     console.warn('Valeur inattendue :', result.originalValue);
 *     console.log(result.value); // TRecord ou null — résultat du fallback
 *     break;
 * }
 * ```
 *
 * @see {@link CircularEventHandler.invoke}
 * @see {@link EventCallResult} pour le type équivalent sur {@link EventHandler}
 */
export type CircularEventCallResult<TRecord extends Record<string, unknown>> =
	/** Aucun callback enregistré — la propagation n'a pas eu lieu. */
	| { type: 'empty' }
	/**
	 * Propagation normale — `value` contient le record final fusionné
	 * après le passage de tous les callbacks.
	 */
	| { type: 'record'; value: TRecord }
	/**
	 * La valeur initiale n'était pas un plain object — elle a été encapsulée
	 * dans `{ default: originalValue }` pour permettre quand même la propagation.
	 * `value` contient le résultat du fallback, `originalValue` la valeur d'origine.
	 */
	| { type: 'other'; value: Nullable<TRecord>; originalValue: unknown };
