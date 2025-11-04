export = JsEvent;
declare type OnCallbackAddedCallback<TCallback extends Function> = (
  key: string,
  callbackAdded: TCallback,
) => void;
declare type OnCallbackRemovedCallback<TCallback extends Function> = (
  key: string,
  callbackRemoved: TCallback,
) => void;

declare class JsEventData<TCallback extends Function> {
  constructor(callback: TCallback, args: any[]);
  callback: TCallback;
  args: any[];
}

/**
 * Représente un évènement. On lui ajoute ou supprime des callbacks, puis on les appelle les un après les autres.
 * @template {Function} TCallback Le format des callbacks qui doivent lui être attachés
 * @class
 */
declare class JsEvent<TCallback extends Function> {
  constructor();
  /**
   * Liste des évènements à appeler
   */
  events: { [Key: string]: JsEventData<TCallback> };
  /**
   * Fire when a callback is added
   * @readonly
   * @event
   */
  readonly onadded: JsEvent<OnCallbackAddedCallback<TCallback>>;
  /**
   * Fire when a callback is removed
   * @event
   * @readonly
   */
  readonly onremoved: JsEvent<OnCallbackRemovedCallback<TCallback>>;

  /**
   * Ajoute un callback
   * @param event Callback qui sera appelé lors de l'appel de l'évènement
   * @param args Liste des arguments qui seront passé aux callback
   * @returns {string} Clé créée
   * @fires JsEvent.onadded
   */
  push(event: TCallback, ...args: any[]): string;
  /**
   * Ajout un callback la clé permettra de le retrouver plus tard.
   * @param key Clé du callback
   * @param event Callback qui sera appelé lors de l'appel de l'évènement
   * @param args Liste des arguments qui seront passé aux callback
   * @fires JsEvent.onadded
   */
  add(key: string, event: TCallback, ...args: any[]): void;
  /**
   * Supprime un callback
   * @param key Clé du callback à supprimer
   * @returns {void}
   */
  remove(key: string): void;
  /**
   * Vérifie si une clé éxiste
   * @param {string} key Clé à vérifier
   * @returns {boolean}
   */
  has(key: string): boolean;
  /**
   * Renvoie si il y a des évènements ou non.
   * @returns {boolean}
   */
  haveEvents(): boolean;
  /**
   * Affiche le nombre d'évènements
   * @returns {number}
   */
  count(): number;
  /**
   * Appèle les callbacks
   * @param  {...any} params Paramètres à envoyer aux callbacks
   * @returns {null | TResult | any[]} Renvoie le résultat du callback ou une liste de résultat
   * @template TResult Type du résultat
   */
  call<TResult>(...params: any): null | TResult | any[];
}
