# @rotomeca/event

[![npm version](https://img.shields.io/npm/v/@rotomeca/event)](https://www.npmjs.com/package/@rotomeca/event)
[![CI](https://github.com/Rotomeca/node-event/actions/workflows/ci.yml/badge.svg)](https://github.com/Rotomeca/node-event/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Docs](https://img.shields.io/badge/docs-github.io-blue)](https://rotomeca.github.io/node-event)

Système d'événements typé à la C# pour Node.js et le navigateur. Inspiré du pattern `event` de C# et de la chaîne de middleware ASP.NET Core, `@rotomeca/event` fournit une API cohérente, sûre et observable pour gérer les callbacks dans vos projets TypeScript.

---

## Installation

```bash
# pnpm
pnpm add @rotomeca/event

# npm
npm install @rotomeca/event

# yarn
yarn add @rotomeca/event
```

---

## Compatibilité

| Environnement     | Support                                  |
| ----------------- | ---------------------------------------- |
| Node.js           | ≥ 18                                     |
| ESM               | ✅                                       |
| CommonJS          | ✅                                       |
| Bundle navigateur | ✅ (`dist/bundle/rotomeca-event.min.js`) |
| TypeScript        | ✅ (types inclus)                        |

---

## Concepts clés

Le package expose deux familles de gestionnaires d'événements et un décorateur :

| Classe                                           | Comportement lors de `invoke`                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `EventHandler` / `EventDelegate`                 | Chaque callback est appelé **indépendamment** — résultats séparés                          |
| `CircularEventHandler` / `CircularEventDelegate` | Chaque callback **reçoit et enrichit** le résultat du précédent (pipeline)                 |
| `@event` / `@circularEvent`                      | Décorateur d'accesseur automatique pour déclarer des événements comme propriétés de classe |

---

## `EventHandler` — événements standard

Inspiré de `EventHandler<TEventArgs>` en C#. Les callbacks sont appelés dans leur ordre d'enregistrement, indépendamment les uns des autres.

```ts
import { EventHandler, EventDelegate } from '@rotomeca/event';

// Avec EventHandler (deux génériques : TArgs + T)
const onClick = new EventHandler<[MouseEvent], (e: MouseEvent) => void>();

// Avec EventDelegate (un seul générique : le type du callback)
const onSubmit = new EventDelegate<(data: FormData) => string>();
```

### Ajouter et retirer des callbacks

```ts
// push — clé générée automatiquement
const key = onClick.push(e => console.log(e.clientX));

// add — clé explicite, chaînable
onClick
	.add('logger', e => console.log(e.clientX))
	.add('tracker', e => analytics.track(e));

// remove — retourne le callback supprimé
const ancien = onClick.remove('logger');

// has — vérification
if (onClick.has('tracker')) {
	onClick.remove('tracker');
}

// clear — supprime tout, retourne this
onClick.clear();
```

### Déclencher l'événement

`invoke` retourne un **type discriminé** à trois cas :

```ts
const result = onClick.invoke(new MouseEvent('click'));

switch (result.type) {
	case 'empty':
		// Aucun callback enregistré
		break;
	case 'single':
		console.log(result.value); // ReturnType<T>
		break;
	case 'multiple':
		console.log(result.values); // Record<string, ReturnType<T>>
		break;
}
```

### Inspecter l'état

```ts
onClick.count(); // → uint — nombre de callbacks
onClick.haveEvents(); // → boolean
onClick.keys; // → string[] — clés dans l'ordre d'enregistrement
onClick.getInvocationList(); // → T[]     — callbacks dans l'ordre d'enregistrement
```

### Arguments par défaut

Chaque callback peut avoir des arguments par défaut, passés avant ceux fournis à `invoke` :

```ts
const onLog = new EventHandler<[string, string]>();

// 'prefix' sera toujours passé en premier
onLog.add(
	'handler',
	(prefix, msg) => console.log(`[${prefix}] ${msg}`),
	'INFO',
);

onLog.invoke('Bonjour'); // → [INFO] Bonjour
```

---

## `CircularEventHandler` — pipeline de transformation

Inspiré du pattern Middleware d'ASP.NET Core. Chaque callback reçoit le record courant, le transforme et retourne un `Partial<TRecord>` qui est mergé dans le record avant d'être transmis au suivant.

```ts
import { CircularEventHandler, CircularEventDelegate } from '@rotomeca/event';

// Avec CircularEventDelegate (un seul générique : le type du record)
const pipeline = new CircularEventDelegate<{ value: number; label: string }>();

pipeline.add('double', ({ value }) => ({ value: value * 2 }));
pipeline.add('label', ({ value }) => ({ label: `result=${value}` }));

const result = pipeline.invoke({ value: 5, label: '' });
// result.type  → 'record'
// result.value → { value: 10, label: 'result=10' }
```

### Résultat discriminé

```ts
switch (result.type) {
	case 'empty':
		// Aucun callback enregistré
		break;
	case 'record':
		console.log(result.value); // TRecord final
		break;
	case 'other':
		// La valeur initiale n'était pas un plain object
		console.warn('Valeur inattendue :', result.originalValue);
		console.log(result.value);
		break;
}
```

---

## `@event` — décorateur d'accesseur

Déclare un `EventHandler` comme propriété gérée d'une classe. Garantit une instanciation unique (singleton par propriété), empêche l'écrasement accidentel via le setter et supporte le chargement lazy ou eager.

> **Prérequis** : nécessite `"experimentalDecorators": false` et les décorateurs ECMAScript Stage 3 (`accessor` keyword).

```ts
import { Listener, NoInitListener, EventHandler } from '@rotomeca/event';

class Button {
	// Lazy (par défaut) — instancié au premier accès
	@event(evt => evt.add('default', () => console.log('clicked')))
	accessor onClick: EventHandler<[], () => void>;

	// Eager — instancié à la construction de l'objet
	@event(NoInitListener, { lazy: false })
	accessor onDestroy: EventHandler<[], () => void>;

	// Circulaire — instancie un CircularEventHandler
	@circularEvent(NoInitListener, { circular: true })
	accessor onTransform: CircularEventHandler<[{ value: number }]>;
}

const btn = new Button();
btn.onClick.push(() => console.log('custom handler'));
btn.onClick.invoke(); // → 'clicked', puis 'custom handler'
```

`NoInitListener` est un placeholder sémantique à utiliser quand vous n'avez pas de logique d'initialisation mais devez passer des options.

---

## Événements d'observation

Chaque gestionnaire expose trois méta-événements, initialisés de façon **lazy** (aucun coût si personne n'y souscrit) :

```ts
const event = new EventHandler<[string]>();

// Déclenché à chaque ajout via add() ou push()
event.onHandlerAdded.push((key, cb) => {
	console.log(`Handler "${key}" ajouté`);
});

// Déclenché à chaque suppression via remove()
event.onHandlerRemoved.push((key, cb) => {
	console.log(`Handler "${key}" retiré`);
});

// Déclenché une seule fois lors d'un clear() — reçoit la liste complète
event.onHandlerCleared.push(callbacks => {
	console.log(`${callbacks.length} handler(s) supprimé(s)`);
});

event.add('a', s => s.toUpperCase()); // → 'Handler "a" ajouté'
event.clear(); // → '1 handler(s) supprimé(s)'
```

---

## Référence des exports publics

```ts
// Classes
import {
	EventHandler,
	EventDelegate,
	CircularEventHandler,
	CircularEventDelegate,
	EventData,
} from '@rotomeca/event';

// Décorateur
import { Listener, NoInitListener } from '@rotomeca/event';

// Types
import type {
	IEventHandler,
	IEventData,
	EventCallResult,
	CircularEventCallResult,
	HandlerAddedCallback,
	HandlerRemovedCallback,
	HandlerClearedCallback,
	CallbackInitializer,
	ListenerOptions,
} from '@rotomeca/event';

// Alias rétrocompatibles (dépréciés)
import { JsEvent, JsCircularEvent } from '@rotomeca/event';
```

---

## Ecosystème Rotomeca

Ce package fait partie d'un écosystème cohérent :

| Package                                                            | Description                               |
| ------------------------------------------------------------------ | ----------------------------------------- |
| [`@rotomeca/utils`](https://www.npmjs.com/package/@rotomeca/utils) | Fonctions pures, types brandés et helpers |
| `@rotomeca/rop`                                                    | Gestion d'erreurs typée (Result\<T, E\>)  |
| [`@rotomeca/event`](https://www.npmjs.com/package/@rotomeca/event) | Ce package                                |
| `@rotomeca/jsenumerable`                                           | LINQ lazy en TypeScript                   |

---

## Contribuer

```bash
git clone https://github.com/Rotomeca/node-event.git
cd node-event
pnpm install
pnpm test
```

Les contributions sont les bienvenues via Pull Request sur la branche `dev`.

---

## Licence

[ISC](LICENSE) © Rotomeca
