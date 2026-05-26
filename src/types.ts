import { Func } from "@rotomeca/utils";

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