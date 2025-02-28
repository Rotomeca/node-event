/**
 * @template T
 * @callback OnCallbackAddedCallback
 * @param {string} key
 * @param {T} callbackAdded
 * @return {void}
 */

/**
 * @template T
 * @callback OnCallbackRemovedCallback
 * @param {string} key
 * @param {T} callbackRemoved
 * @return {void}
 */

/**
 * @class
 * @classdesc Contient les données d'un callback. La fonction et les arguments.
 * @template T
 * @package
 */
class JsEventData {
  /**
   * T doit être une fonction
   * @param {T} callback Fonction qui sera appelé
   * @param {Array} args Arguments à ajouter lorsque la fonction sera appelé
   */
  constructor(callback, args) {
    /**
     * Fonction qui sera appelé
     * @type {T}
     */
    this.callback = callback;
    /**
     * Arguments à ajouter lorsque la fonction sera appelé
     * @type {Array}
     */
    this.args = args;
  }
}

/**
 * @class
 * @classdesc Représente un évènement. On lui ajoute ou supprime des callbacks, puis on les appelle les un après les autres.
 * @template T
 */
class JsEvent {
  #_onnadded;
  #_onremoved;
  /**
   * Constructeur de la classe.
   */
  constructor() {
    /**
     * Liste des évènements à appeler
     * @type {Object<string, JsEventData<T>>}
     * @member
     */
    this.events = {};
  }

  /**
   * Fire when a callback is added
   * @type {JsEvent<OnCallbackAddedCallback<T>>}
   * @readonly
   * @event
   */
  get onadded() {
    if (!this.#_onnadded) this.#_onnadded = new JsEvent();

    return this.#_onnadded;
  }

  /**
   * Fire when a callback is removed
   * @type {JsEvent<OnCallbackRemovedCallback<T>>}
   * @event
   * @readonly
   */
  get onremoved() {
    if (!this.#_onremoved) this.#_onremoved = new JsEvent();

    return this.#_onremoved;
  }

  /**
   * Ajoute un callback
   * @param {T} event Callback qui sera appelé lors de l'appel de l'évènement
   * @param  {...any} args Liste des arguments qui seront passé aux callback
   * @returns {string} Clé créée
   * @fires JsEvent.onadded
   */
  push(event, ...args) {
    const key = this.#_generateKey();
    this.add(key, event, ...args);
    return key;
  }

  /**
   * Ajoute un callback avec un clé qui permet de le retrouver plus tard
   * @param {string} key Clé de l'évènement
   * @param {T} event Callback qui sera appelé lors de l'appel de l'évènement
   * @param  {...any} args Liste des arguments qui seront passé aux callback
   * @fires JsEvent.onadded
   */
  add(key, event, ...args) {
    this.events[key] = new JsEventData(event, args);
    this.onadded.call(key, this.events[key]);
  }

  /**
   * Vérifie si une clé éxiste
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return !!this.events[key];
  }

  /**
   * Supprime un callback
   * @param {string} key Clé
   * @fires JsEvent.onremoved
   */
  remove(key) {
    this.onremoved.call(key, this.events[key]);
    this.events[key] = null;
  }

  /**
   * Renvoie si il y a des évènements ou non.
   * @returns {boolean}
   */
  haveEvents() {
    return this.count() > 0;
  }

  /**
   * Affiche le nombre d'évènements
   * @returns {number}
   */
  count() {
    return Object.keys(this.events).length;
  }

  /**
   * Appèle les callbacks
   * @param  {...any} params Paramètres à envoyer aux callbacks
   * @returns {null | any | Array}
   */
  call(...params) {
    let results = {};
    const keys = Object.keys(this.events);

    if (keys.length !== 0) {
      for (let index = 0, len = keys.length; index < len; ++index) {
        const key = keys[index];

        if (this.events[key]) {
          const { args, callback } = this.events[key];

          if (callback)
            results[key] = this.#_call_callback(
              callback,
              ...[...args, ...params],
            );
        }
      }
    }

    switch (Object.keys(results).length) {
      case 0:
        return null;
      case 1:
        return results[Object.keys(results)[0]];
      default:
        return results;
    }
  }

  /**
   * Vide la classe
   */
  clear() {
    this.events = {};
  }

    /**
   * Lance un callback
   * @param {T} callback Callback à appeler
   * @param  {...any} args Paramètres à envoyer aux callbacks
   * @returns {*}
   * @private
   */
  #_call_callback(callback, ...args) {
    return callback(...args);
  }

  /**
   * Génère une clé pour l'évènement
   * @private
   * @returns {string}
   */
  #_generateKey() {
    const g_key = Math.random() * (this.count() + 10);

    let ae = false;
    for (const key in this.events) {
      if (Object.hasOwnProperty.call(this.events, key)) {
        if (key === g_key) {
          ae = true;
          break;
        }
      }
    }

    if (ae) return this.#_generateKey();
    else return g_key;
  }
}

module.exports = JsEvent;
