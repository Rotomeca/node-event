import { Func } from "@rotomeca/utils";

/**
 * Représente les données associées à un callback d'événement.
 *
 * Encapsule le callback lui-même ainsi que les arguments par défaut
 * qui lui seront transmis à chaque appel.
 *
 * @typeParam TArgs - Tuple représentant les types des arguments du callback.
 *                    Par défaut `any[]`.
 * @typeParam T - Type du callback, doit étendre `Func<TArgs>`.
 *               Par défaut `Func<TArgs>`.
 *
 * @example
 * ```ts
 * const data: IEventData<[string, number]> = {
 *   callback: (msg, code) => console.log(msg, code),
 *   args: ['bonjour', 42],
 * };
 * ```
 */
export interface IEventData<
  TArgs extends any[] = any[],
  T extends Func<TArgs> = Func<TArgs>,
> {
  /**
   * Le callback à exécuter lors du déclenchement de l'événement.
   */
  readonly callback: T;

  /**
   * Les arguments par défaut transmis au callback lors de l'appel.
   * Ils sont passés avant les arguments fournis lors de l'appel de l'événement.
   */
  readonly args: TArgs;
}