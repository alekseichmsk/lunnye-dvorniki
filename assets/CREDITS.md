# Модели и лицензии

Игровые модели лежат в `assets/models/`. Часть собрана из CC0-набора Kenney и перекрашена в Blender (`blender/import_cc0.py`). Щётки, веники, пылесосы, ракета, дрон и флаг смоделированы для этой игры (`blender/build_models.py`).

| Файл | Что это | Источник | Автор | Лицензия |
| --- | --- | --- | --- | --- |
| `janitor.glb` | Дворник, отдельные руки и ноги, гнездо `tool_socket` | [Space Kit 2.0](https://kenney.nl/assets/space-kit), модель `astronautA` | Kenney (kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `vehicle_pyh.glb` | Лунокат «Пых» | Space Kit, `rover`, плюс отдельные колёса | Kenney | CC0 1.0 |
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
| `prop_crystals.glb` | Кристаллы оранжереи | Space Kit, `rock_crystals` | Kenney | CC0 1.0 |
| `depot.glb` | Площадка приёмника | Space Kit, `platform_large`; ракета на площадке собрана в этом проекте | Kenney и этот проект | CC0 для площадки |
| `tool_*.glb`, `rocket.glb`, `robot_drone.glb`, `prop_flag.glb`, `prop_cactus.glb` | Щётка, веник, швабра, пылесосы, поздние аппараты, ракета, дрон, флаг, кактус | Смоделированы в Blender для «Лунных дворников» | Этот проект | Можно использовать вместе с игрой; отдельные права третьих лиц не задействованы |

Исходные glTF Kenney, из которых собран экспорт, лежат в `third_party/kenney-space-kit/` вместе с `License.txt`. Указание автора не обязательно для CC0, но мы его сохраняем.

Three.js (`vendor/three/`) — библиотека с лицензией MIT, https://github.com/mrdoob/three.js/blob/master/LICENSE
