# Décisions d'architecture — @rotomeca/event

Ce document explique les choix techniques structurants du package. Chaque décision est accompagnée de son contexte, de la solution retenue et des alternatives écartées.

---

## D-001 — `EventCallResult` : type discriminé à trois cas

**Contexte**
Un gestionnaire d'événements peut avoir zéro, un ou plusieurs callbacks. Retourner une valeur brute (`ReturnType<T> | null`) est ambigu dès que `ReturnType<T>` est lui-même un tableau ou un objet — impossible de distinguer "pas de résultat" d'un callback qui retourne `null`, ou un callback unique qui retourne un tableau d'un gestionnaire à plusieurs callbacks.

**Décision**
`invoke` retourne un type discriminé :
```ts
type EventCallResult<T extends Func> =
  | { type: 'empty' }
  | { type: 'single'; value: ReturnType<T> }
  | { type: 'multiple'; values: Record<string, ReturnType<T>> };
```
Le champ `type` permet un switch exhaustif sans aucune heuristique sur la valeur retournée. `values` est indexé par clé de callback plutôt que par position pour conserver la traçabilité.

**Pourquoi pas une valeur brute ou un tableau ?**
Une valeur brute force le consommateur à inférer le nombre de callbacks à partir du type de retour — ce qui casse dès que `ReturnType<T>` est un tableau. Un tableau homogène perd la correspondance key/valeur utile au débogage.

**`call()` déprécié**
L'ancienne méthode `call()` retourne `Nullable<ReturnType<T> | ReturnType<T>[]>` — exactement le type ambigu décrit ci-dessus. Elle est conservée pour la compatibilité ascendante mais redirige vers `invoke` en interne.

---

## D-002 — `CircularEventHandler` : pipeline à propagation de record

**Contexte**
Certains usages nécessitent que chaque callback enrichisse progressivement un état partagé plutôt que de produire des résultats indépendants — transformations de données, chaînes de validation, pipelines de rendu.

**Décision**
`CircularEventHandler` implémente un pattern Middleware inspiré d'ASP.NET Core : chaque callback reçoit le record courant, retourne un `Partial<TRecord>`, et ce partiel est mergé (via `deepMerge` de `@rotomeca/utils`) dans le record avant le callback suivant.

```ts
// 5 → double → 10 → addTen → 20
pipeline.add('double',  ({ value }) => ({ value: value * 2 }));
pipeline.add('addTen',  ({ value }) => ({ value: value + 10 }));
pipeline.invoke({ value: 5 }); // → { type: 'record', value: { value: 20 } }
```

**Contrainte plain object**
Si `args_0` n'est pas un plain object, un avertissement est émis, la valeur est encapsulée dans `{ default: args_0 }` et le résultat est de type `'other'`. Cela protège la cohérence du merge sans lever d'exception et permet au consommateur de gérer le cas dégradé via le discriminant.

**Pourquoi pas un reduce ou une fonction de composition ?**
Le pattern gestionnaire d'événements (add/remove/clear/onHandlerAdded…) est réutilisé à l'identique. Introduire une API séparée (`pipe`, `compose`) aurait créé deux systèmes parallèles à maintenir pour un cas d'usage similaire.

---

## D-003 — `AEventHandler` : classe abstraite avec accès protégé à la Map

**Contexte**
`EventHandler` et `CircularEventHandler` partagent toute la logique de gestion des callbacks (Map interne, génération des clés, méta-événements, `add/remove/clear/has/count`). Seule `invoke` diffère.

**Décision**
Une classe abstraite `AEventHandler` centralise la logique commune. La Map interne est privée (`#_callbacks`) et accessible aux sous-classes uniquement via `_p_get(key)` — un accesseur protégé qui retourne les données d'un callback sans exposer la Map entière.

**Pourquoi pas une composition (Strategy) ?**
La composition aurait nécessité de déléguer une dizaine de méthodes publiques depuis chaque classe concrète, sans gain réel — la stratégie variable (`invoke`) est unique et bien isolée par l'abstraction.

**Méthodes d'initialisation des méta-événements**
Les trois méthodes `_p_initOnHandlerAdded`, `_p_initOnHandlerRemoved`, `_p_initOnHandlerCleared` sont abstraites pour permettre à chaque classe concrète de choisir son propre type de gestionnaire interne (toujours `EventHandler` dans les implémentations actuelles).

---

## D-004 — Méta-événements lazy (`onHandlerAdded`, `onHandlerRemoved`, `onHandlerCleared`)

**Contexte**
La grande majorité des gestionnaires d'événements n'a pas d'observateurs sur ses propres mutations. Instancier systématiquement trois `EventHandler` supplémentaires par instance serait un surcoût mémoire et CPU injustifié.

**Décision**
Les trois méta-événements sont initialisés via le pattern `??=` lors du **premier accès** à leur getter. Avant ce premier accès, la référence interne est `undefined` — les branches de notification dans `add`, `remove` et `clear` vérifient `isDefined` avant de déclencher, sans jamais forcer l'initialisation.

```ts
// Dans add() : ne crée pas onHandlerAdded si personne n'y a accédé
if (isDefined(this.#_handlerAdded) && this.onHandlerAdded.haveEvents())
  this.onHandlerAdded.invoke(key, event);
```

**`onHandlerCleared` : O(1) vs O(n)**
`clear()` capture la liste des callbacks **avant** l'effacement, vide la Map en O(1), puis notifie. La notification reçoit la liste complète, ce qui évite N déclenchements successifs de `onHandlerRemoved` pour un clear global.

---

## D-005 — Génération de clés aléatoires et résolution de collision

**Contexte**
`push()` génère automatiquement une clé pour le callback. Cette clé doit être unique dans la Map courante, reproductible uniquement dans les bornes de l'instance, et ne pas prévisiblement entrer en collision avec les clés nommées que le consommateur pourrait utiliser via `add()`.

**Décision**
La clé est générée via `Random.randomString(length)` de `@rotomeca/utils`, avec une longueur aléatoire entre 5 et 20 caractères. En cas de collision (improbable mais possible), la méthode s'appelle récursivement jusqu'à trouver une clé libre.

**Pourquoi pas un compteur incrémental ?**
Un compteur (`handler_1`, `handler_2`…) est prédictible et entre facilement en conflit avec des clés nommées par le consommateur si celui-ci suit la même convention. Une chaîne aléatoire rend la collision intentionnelle difficile.

---

## D-006 — `EventDelegate` / `CircularEventDelegate` : ergonomie à un générique

**Contexte**
`EventHandler<[MouseEvent], (e: MouseEvent) => void>` est verbeux : `TArgs` et `T` sont redondants dès que `T` est une signature de fonction complète.

**Décision**
`EventDelegate<T>` étend `EventHandler<Parameters<T>, T>` : le consommateur ne spécifie que le type du callback, et `Parameters<T>` est extrait automatiquement.

```ts
// Verbeux
const e1 = new EventHandler<[MouseEvent], (e: MouseEvent) => void>();

// Ergonomique
const e2 = new EventDelegate<(e: MouseEvent) => void>();
```

`CircularEventDelegate<TRecord>` suit le même principe pour `CircularEventHandler`.

**Alias dépréciés**
`JsEvent` et `JsCircularEvent` sont des alias de `EventDelegate` et `CircularEventDelegate` conservés pour la compatibilité ascendante avec les versions 1.x et 2.x.

---

## D-007 — Décorateur `@Listener` : singleton par propriété via Symbol

**Contexte**
En TypeScript, déclarer un `EventHandler` comme propriété de classe impose soit une initialisation dans le constructeur (ordre fragile, constructeur alourdi), soit un getter manuel (boilerplate répété). Les décorateurs ES Stage 3 permettent d'automatiser ce pattern.

**Décision**
`@Listener` décore un `auto-accessor`. Chaque propriété décorée reçoit un `Symbol` unique à la compilation (`Symbol('listener_<name>')`). L'instance du gestionnaire est stockée dans une `Map<symbol, EventHandler>` attachée à l'instance de la classe via une clé Symbol partagée (`listenersCacheKey`).

```ts
class Button {
  @Listener((evt) => evt.add('default', () => console.log('clicked')))
  accessor onClick: EventHandler<[], () => void>;
}
```

**Setter bloqué**
Le setter lève une `Error` explicite. Sans cela, une assignation accidentelle (`this.onClick = new EventHandler()`) remplacerait silencieusement le gestionnaire configuré par le décorateur, perdant les abonnés enregistrés.

**Lazy vs Eager**
`lazy: true` (défaut) différer l'initialisation au premier accès au getter — aucun coût si la propriété n'est jamais lue. `lazy: false` appelle `context.addInitializer`, déclenchant la création à la construction de l'objet — utile quand l'initializator a des effets de bord importants à garantir tôt dans le cycle de vie.

**`NoInitListener`**
Placeholder nommé pour les cas où aucune logique d'initialisation n'est requise mais où des options (`circular`, `lazy`) doivent être passées. Préféré à `null` ou `() => {}` pour rendre l'intention explicite dans le code source.

---

## D-008 — Arguments par défaut par callback

**Contexte**
Certains callbacks ont besoin de contexte fixe lors de leur enregistrement (un préfixe de log, un identifiant d'instance) sans que ce contexte soit connu de l'appelant d'`invoke`.

**Décision**
`add(key, callback, ...defaultArgs)` et `push(callback, ...defaultArgs)` stockent les arguments par défaut dans `EventData`. Lors d'`invoke(...params)`, chaque callback est appelé avec `[...defaultArgs, ...params]`.

```ts
onLog.add('handler', (prefix, msg) => console.log(`[${prefix}] ${msg}`), 'INFO');
onLog.invoke('Bonjour'); // → '[INFO] Bonjour'
```

Cela permet l'injection de dépendances légère au moment de l'abonnement, sans wrappers manuels.

---

## D-009 — Dual build ESM + CJS + bundle navigateur

**Contexte**
Identique à `@rotomeca/utils` (voir D-002 de ce package) : l'écosystème Node.js reste partagé entre ESM et CJS.

**Décision**
Deux compilations TypeScript distinctes : `tsconfig.json` → `dist/esm/` et `tsconfig.cjs.json` → `dist/cjs/`. Les champs `exports` du `package.json` routent les résolutions.

Un **bundle navigateur** (`dist/bundle/rotomeca-event.min.js`) est produit séparément via `build-bundle.js` (esbuild) et exposé sous l'entrée `./bundle`. Ce bundle n'est pas inclus dans le build standard (`pnpm build`) mais nécessite `pnpm run bundle` ou `pnpm run build:all`.

**`sideEffects: false`**
Déclaré dans `package.json` pour permettre le tree-shaking agressif par Vite, webpack et Rollup.

---

## D-010 — Dépendance unique : `@rotomeca/utils`

**Contexte**
Le package s'appuie sur des utilitaires déjà testés et maintenus (`deepMerge`, `isDefined`, `pipe`, `isPlainObject`, types brandés, `Random`) plutôt que de les réimplémenter localement.

**Décision**
`@rotomeca/utils` est la seule dépendance de production. Elle est déclarée en `dependencies` (pas `peerDependencies`) car son API est utilisée directement dans le code exposé aux consommateurs. Toutes les autres dépendances (`vitest`, `typescript`, `typedoc`, `esbuild`) restent en `devDependencies`.
