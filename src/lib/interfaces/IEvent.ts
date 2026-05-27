import { Func, MayBe, uint } from '@rotomeca/utils';
import { IEventData } from './IEventData';
import {
	EventCallResult,
	HandlerAddedCallback,
	HandlerClearedCallback,
	HandlerRemovedCallback,
} from '../utils/types';

/**
 * Représente un gestionnaire d'événement typé auquel on peut attacher,
 * retirer et déclencher des callbacks.
 *
 * Inspiré du pattern
 * [`event`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/)
 * de C#, mais enrichi d'une valeur de retour sur les callbacks pour
 * permettre des usages plus avancés.
 *
 * @typeParam TArgs - Tuple représentant les types des arguments transmis
 *                    aux callbacks lors de l'appel. Par défaut `any[]`.
 * @typeParam T - Type des callbacks attachés à l'événement,
 *               doit étendre `Func<TArgs>`. Par défaut `Func<TArgs>`.
 *
 * @example
 * ```ts
 * const onClick: IEventHandler<[MouseEvent]> = new EventHandler();
 *
 * onClick.add('handler', (e) => console.log(e.clientX));
 * onClick.invoke(new MouseEvent('click'));
 * ```
 *
 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.eventhandler-1 | EventHandler\<TEventArgs\> — C#}
 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/ | Événements — Guide C#}
 */
export interface IEventHandler<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
	TResult = EventCallResult<T>,
> {
	/**
	 * Événement déclenché chaque fois qu'un handler est ajouté
	 * via {@link add} ou {@link push}.
	 *
	 * Permet d'observer les ajouts sans sous-classer. Chaque callback
	 * reçoit la clé et le handler nouvellement enregistré.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerAdded.push((key, cb) => {
	 *   console.log(`Handler "${key}" ajouté`);
	 * });
	 * ```
	 *
	 * @see {@link HandlerAddedCallback}
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.collections.specialized.inotifycollectionchanged | INotifyCollectionChanged — C#}
	 */
	get onHandlerAdded(): IEventHandler<
		Parameters<HandlerAddedCallback<TArgs, T>>,
		HandlerAddedCallback<TArgs, T>
	>;

	/**
	 * Événement déclenché chaque fois qu'un handler est retiré
	 * via {@link remove}.
	 *
	 * Permet d'observer les suppressions sans sous-classer. Chaque callback
	 * reçoit la clé et le handler qui vient d'être retiré.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerRemoved.push((key, cb) => {
	 *   console.log(`Handler "${key}" retiré`);
	 * });
	 * ```
	 *
	 * @see {@link HandlerRemovedCallback}
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.collections.specialized.inotifycollectionchanged | INotifyCollectionChanged — C#}
	 */
	get onHandlerRemoved(): IEventHandler<
		Parameters<HandlerRemovedCallback<TArgs, T>>,
		HandlerRemovedCallback<TArgs, T>
	>;

	/**
	 * Événement déclenché une seule fois lorsque tous les handlers sont
	 * supprimés via {@link clear}.
	 *
	 * Préférable à {@link onHandlerRemoved} pour réagir à un effacement global —
	 * se déclenche en O(1) quelle que soit la taille de la liste, là où
	 * itérer sur {@link onHandlerRemoved} coûterait O(n).
	 *
	 * Chaque callback reçoit la liste complète des handlers supprimés,
	 * permettant par exemple de les sauvegarder ou de les réenregistrer ailleurs.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerCleared.push((_, callbacks) => {
	 *   console.log(`${callbacks.length} handler(s) supprimé(s)`);
	 * });
	 *
	 * event.clear(); // → "3 handler(s) supprimé(s)"
	 * ```
	 *
	 * @see {@link HandlerClearedCallback}
	 * @see {@link onHandlerRemoved} pour la suppression unitaire
	 */
	get onHandlerCleared(): IEventHandler<
		Parameters<HandlerClearedCallback<TArgs, T>>,
		HandlerClearedCallback<TArgs, T>
	>;

	/**
	 * Retourne la liste des clés des callbacks actuellement enregistrés.
	 *
	 * @example
	 * ```ts
	 * const keys = event.keys; // ['handler1', 'handler2']
	 * ```
	 */
	get keys(): string[];

	/**
	 * Ajoute un callback en générant automatiquement une clé unique.
	 *
	 * Équivalent de l'opérateur
	 * [`+=`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events)
	 * en C#.
	 *
	 * @param event - Le callback à ajouter.
	 * @param args - Arguments par défaut transmis au callback à chaque appel.
	 * @returns La clé générée permettant de retrouver ce callback plus tard.
	 */
	push(event: T, ...args: Partial<TArgs>): string;

	/**
	 * Ajoute un callback avec une clé spécifique.
	 *
	 * Équivalent de l'opérateur
	 * [`+=`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events)
	 * en C#, avec contrôle explicite de l'identifiant.
	 *
	 * @param key - Clé identifiant le callback.
	 * @param event - Le callback à ajouter.
	 * @param args - Arguments par défaut transmis au callback à chaque appel.
	 * @returns L'instance courante pour permettre le chaînage.
	 */
	add(key: string, event: T, ...args: Partial<TArgs>): this;

	/**
	 * Vérifie si un callback est enregistré sous la clé donnée.
	 *
	 * @param key - La clé à vérifier.
	 * @returns `true` si un callback existe pour cette clé, `false` sinon.
	 *
	 * @example
	 * ```ts
	 * if (event.has('monHandler')) {
	 *   event.remove('monHandler');
	 * }
	 * ```
	 */
	has(key: string): boolean;

	/**
	 * Supprime le callback associé à la clé donnée et le retourne.
	 *
	 * Équivalent de l'opérateur
	 * [`-=`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events)
	 * en C#. Utile pour récupérer un handler existant afin de le réenregistrer
	 * sous une autre clé ou dans un autre événement.
	 *
	 * @param key - La clé du callback à supprimer.
	 * @returns Le callback supprimé, si il éxiste.
	 *
	 * @example
	 * ```ts
	 * const ancien = event.remove('monHandler');
	 * event.add('nouveauHandler', ancien);
	 * ```
	 */
	remove(key: string): MayBe<T>;

	/**
	 * Indique si au moins un callback est enregistré.
	 *
	 * @returns `true` si l'événement a au moins un callback, `false` sinon.
	 */
	haveEvents(): boolean;

	/**
	 * Retourne le nombre de callbacks actuellement enregistrés.
	 *
	 * @returns Le nombre de callbacks sous forme de {@link uint}.
	 */
	count(): uint;

	/**
	 * Déclenche tous les callbacks enregistrés avec les arguments fournis.
	 *
	 * Équivalent de
	 * [`Invoke`](https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.invoke)
	 * en C#. Le résultat dépend du nombre de callbacks enregistrés :
	 * - `{ type: 'empty' }` si aucun callback n'est enregistré.
	 * - `{ type: 'single', value }` si un seul callback est enregistré.
	 * - `{ type: 'multiple', values }` si plusieurs callbacks sont enregistrés.
	 *
	 * @param args - Arguments transmis à chaque callback lors de l'appel.
	 * @returns Un {@link EventCallResult} décrivant le résultat de l'appel.
	 *
	 * @example
	 * ```ts
	 * const result = event.invoke('bonjour', 42);
	 *
	 * if (result.type === 'single') {
	 *   console.log(result.value);
	 * }
	 * ```
	 *
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.invoke | Delegate.Invoke — C#}
	 */
	invoke(...args: TArgs): TResult;

	/**
	 * Supprime tous les callbacks enregistrés.
	 *
	 * @returns L'instance courante pour permettre le chaînage.
	 *
	 * @example
	 * ```ts
	 * event.clear().add('handler', monCallback);
	 * ```
	 */
	clear(): this;

	/**
	 * Retourne la liste des callbacks actuellement enregistrés.
	 *
	 * Équivalent de
	 * [`Delegate.GetInvocationList()`](https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.getinvocationlist)
	 * en C# — permet d'inspecter les callbacks sans les déclencher, dans le
	 * même ordre qu'ils seront appelés lors d'un {@link invoke}.
	 *
	 * @returns Un tableau contenant tous les callbacks enregistrés,
	 *          dans leur ordre d'enregistrement.
	 *
	 * @example
	 * ```ts
	 * const handlers = event.getInvocationList();
	 * console.log(`${handlers.length} handler(s) enregistré(s)`);
	 * ```
	 *
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.getinvocationlist | Delegate.GetInvocationList() — C#}
	 */
	getInvocationList(): T[];
}
