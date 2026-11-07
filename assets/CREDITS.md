# Модели и лицензии

Игровые модели лежат в `assets/models/`. Часть собрана из CC0-набора Kenney и перекрашена в Blender (`blender/import_cc0.py`). Инструменты, корабль, посадочные модули, ракета, дрон, флаг и кактус смоделированы для этой игры (`blender/build_models.py`).

| Файл | Что это | Источник | Автор | Лицензия |
| --- | --- | --- | --- | --- |
| `janitor.glb` | Марсианский дворник: шлем, визор, рюкзак, перчатки, ботинки, гнездо `tool_socket` | Смоделирован в Blender для этой игры | Этот проект | Можно использовать вместе с игрой |
| `vehicle_pyh.glb` | Марсоход «Пых» | Space Kit, `rover` (штатные колёса, без второй пары) | Kenney | CC0 1.0 |
| `vehicle_blin.glb` | Каток «Блин» | Space Kit, `craft_miner`, плюс колёса | Kenney | CC0 1.0 |
| `vehicle_iskra.glb` | Гонщик «Искра» | Space Kit, `craft_racer`, плюс колёса | Kenney | CC0 1.0 |
| `robot_chistik.glb` | Робот «Чистик» | Space Kit, `alien` | Kenney | CC0 1.0 |
| `robot_beetle.glb` | «Жук-пылесос» | Space Kit, `rover` | Kenney | CC0 1.0 |
| `robot_caravan.glb` | Караван «Тихоход» | Space Kit, `craft_cargoA` | Kenney | CC0 1.0 |
| `prop_rock.glb` | Камень | Space Kit, `rock_largeA` | Kenney | CC0 1.0 |
| `prop_crater.glb` | Кратер | Space Kit, `craterLarge` | Kenney | CC0 1.0 |
| `prop_dish.glb` | Тарелка связи | Space Kit, `satelliteDish` | Kenney | CC0 1.0 |
| `prop_dome.glb` | Круглый ангар | Space Kit, `hangar_roundA` | Kenney | CC0 1.0 |
| `prop_hut.glb` | Малый ангар | Space Kit, `hangar_smallA` | Kenney | CC0 1.0 |
| `prop_airlock.glb` | Шлюзовая конструкция | Space Kit, `structure` | Kenney | CC0 1.0 |
| `prop_crystals.glb` | Кристаллы | Space Kit, `rock_crystals` | Kenney | CC0 1.0 |
| `ship.glb` | Корабль-приёмник: опоры, рампа, трюм, двигатели, антенна, иллюминаторы | Смоделирован в Blender | Этот проект | Можно использовать вместе с игрой |
| `lander.glb` | Запасной посадочный модуль | Смоделирован в Blender | Этот проект | Можно использовать вместе с игрой |
| `tool_*.glb`, `rocket.glb`, `robot_drone.glb`, `prop_flag.glb`, `prop_cactus.glb` | Щётка, веник, швабра, пылесосы, поздние аппараты, ракета, дрон, флаг, кактус | Смоделированы в Blender | Этот проект | Можно использовать вместе с игрой; отдельные права третьих лиц не задействованы |

Исходные glTF Kenney, из которых собран экспорт, лежат в `third_party/kenney-space-kit/` вместе с `License.txt`. Указание автора не обязательно для CC0, но мы его сохраняем.

`rose-bloom.png` и `rose-icon.png` — вырезка передней розы со снимка игрока (кремовые лепестки с розовой кромкой, фон убран). Низкополигональные цветы на чистой земле повторяют эти цвета и собираются в коде, без отдельной модели.

Three.js (`vendor/three/`) — библиотека с лицензией MIT, https://github.com/mrdoob/three.js/blob/master/LICENSE
