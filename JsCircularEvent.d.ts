import JsEvent from "./JsEvent";
export = JsCircularEvent;
/**
 * Représente un évènement. On lui ajoute ou supprime des callbacks, puis on les appelle les un après les autres.
 * 
 * Le paramètre de la fonction `call` est mis à jours au fur et à mesure.
 * 
 * @template {Function} TCallback Le format des callbacks qui doivent lui être attachés
 * @class
 */
declare class JsCircularEvent<TCallback extends Function> extends JsEvent<TCallback> {
    /**
     * Appèle les callbacks.
     * 
     * Le paramètre est mis à jours au fur et à mesure.
     * 
     * @param param Paramètre à envoyer aux callbacks
     */
    call<TItem>(param: Object<string, TItem>): Object<string, TItem>;
}