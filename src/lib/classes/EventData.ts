import { Func } from '@rotomeca/utils';
import { IEventData } from '../interfaces';

/**
 * Implémentation concrète de {@link IEventData}.
 *
 * @typeParam TArgs - Tuple représentant les types des arguments du callback.
 *                    Par défaut `any[]`.
 * @typeParam T - Type du callback, doit étendre `Func<TArgs>`.
 *               Par défaut `Func<TArgs>`.
 *
 * @example
 * ```ts
 * const data = new EventData((msg: string) => console.log(msg), 'bonjour');
 * const event = new EventHandler();
 * event.push(data);
 * ```
 *
 * @implements {IEventData}
 */
export class EventData<
	TArgs extends any[] = any[],
	TResult extends any = any,
	T extends Func<TArgs, TResult> = Func<TArgs, TResult>,
> implements IEventData<TArgs, T> {
	/**
	 * Le callback à exécuter lors du déclenchement de l'événement.
	 */
	public callback: T;

	/**
	 * Les arguments par défaut transmis au callback lors de l'appel.
	 * Ils sont passés avant les arguments fournis lors du déclenchement
	 * de l'événement.
	 */
	public args: TArgs;

	/**
	 * Crée une instance de {@link EventData}.
	 *
	 * @param callback - Le callback à encapsuler.
	 * @param args - Les arguments par défaut transmis au callback à chaque appel.
	 */
	constructor(callback: T, ...args: TArgs) {
		this.callback = callback;
		this.args = args;
	}
}
