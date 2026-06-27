# Regression Tests

Check after each run: `~/Downloads/blockly_debug.json` — `dropped=[]`, `inputFailures=[]`, `error=null`.
**Clear Workspace** before each group unless marked *(continue)*.

---

## Group 1 — Baseline (Test button, no LLM)
| # | Input | Expected |
|---|-------|----------|
| T1 | Click **Test** button | INITIATE→RESET_GRAPH(red)→CONTROLS_FOR(angleDeg,−360→360,10)→GRAPH; Y=sin(angleDeg); 11–12 blocks; `inputFailures=[]` |

---

## Group 2 — Trig / Math
| # | Input | Expected |
|---|-------|----------|
| T2 | `display a sin graph from 0 to 360 degrees` | INITIATE→RESET_GRAPH→CONTROLS_FOR(0→360)→GRAPH; Y=MATH_TRIG("sin"); `inputFailures=[]` |
| T3 | `display sinus with amplitude 5 and frequency 0.5pi` | Y = MATH_ARITHMETIC(×, MATH_NUMBER(5), MATH_TRIG(sin, MATH_ARITHMETIC(×, MATH_NUMBER(0.5), angleDeg))); `inputFailures=[]` |
| T4 *(continue)* | `change the frequency to 1*pi` | Gemini emits `modify` on freq block; `spawnStats.drag=0`; no new root blocks |
| T5 *(continue)* | `change the amplitude to 10` | Gemini emits `modify` on amplitude block; `spawnStats.drag=0` |
| T6 | `display a cosine graph from 0 to 360 degrees` | MATH_TRIG field = "cos"; `inputFailures=[]` |
| T7 | `display a tangent graph from 0 to 89 degrees` | MATH_TRIG field = "tan"; range 0→89; `inputFailures=[]` |
| T8 | `compute square root of 144` | INITIATE → MATH_SINGLE("square root") with MATH_NUMBER(144) |
| T9 | `pick a random integer between 1 and 100` | INITIATE → MATH_RANDOM_INT; values 1 and 100 |
| T10 | `display the value of pi on the screen` | MATH_CONSTANT block with "π" — NOT MATH_NUMBER with 3.14159 |

---

## Group 3 — Virtual Display
| # | Input | Expected |
|---|-------|----------|
| T11 | `show "Hello World" in blue on the LCD` | INITIATE→LCD_MESSAGE("Hello World", blue); `inputFailures=[]` |
| T12 | `display the number 42 on line 2 offset 0 in green` | INITIATE→LCD_TEXT("42", 2, 0, green) |
| T13 | `set the LED to red` | INITIATE→LED("red") |
| T14 | `draw a red dot at x=5 y=5 on the graph` | INITIATE→RESET_GRAPH→GRAPH; x=5, y=5, color=red |
| T15 | `reset the graph to blue` | INITIATE→RESET_GRAPH(blue) |

---

## Group 4 — Flow Control / Logic
| # | Input | Expected |
|---|-------|----------|
| T16 | `repeat "hello" 5 times on the LCD` | INITIATE→CONTROLS_REPEAT_EXT(5)→LCD_MESSAGE("hello") |
| T17 | `if true show "yes" else show "no" on screen` | INITIATE→CONTROLS_IF(else)→LCD_MESSAGE("yes") / LCD_MESSAGE("no") |
| T18 | `wait 2 seconds then show "done"` | INITIATE→WAIT(2)→LCD_MESSAGE("done") |
| T19 | `count from 1 to 10 and show the counter on screen` | INITIATE→CONTROLS_FOR(i,1→10,1)→LCD_MESSAGE with VAR_GET(i) |

---

## Group 5 — Text & Variables
| # | Input | Expected |
|---|-------|----------|
| T20 | `set variable x to 7 then show it on screen` | INITIATE→VAR_SET(x,7)→LCD_MESSAGE with VAR_GET(x) |
| T21 | `speak "Good morning" out loud` | INITIATE→TEXTTOVOICE("Good morning") |
| T22 | `join "Hello" and "World" and show it` | INITIATE→TEXT_JOIN→LCD_MESSAGE |

---

## Group 6 — Lists
| # | Input | Expected |
|---|-------|----------|
| T23 | `create a list with the numbers 1, 2, 3` | INITIATE→LISTS_CREATE_WITH; 3 MATH_NUMBER items (1,2,3) |
| T24 | `get the first item from list myList` | INITIATE→LISTS_GETINDEX; position=1, list=VAR_GET(myList) |
| T25 | `show the length of list myList on screen` | INITIATE→LCD_MESSAGE with LISTS_LENGTH(VAR_GET(myList)) |
| T26 | `sort list myList in ascending order` | INITIATE→LISTS_SORT; ascending |

---

## Group 7 — Sensors
| # | Input | Expected |
|---|-------|----------|
| T27 | `wait until button 1 is pressed` | INITIATE→VIRTUAL_SENSOR_WAIT; sensor=button/key 1 |
| T28 | `read the angle sensor and show it on screen` | INITIATE→SENSOR_MEASURE(angle)→LCD_MESSAGE with the reading |

---

## Group 8 — Communication
| # | Input | Expected |
|---|-------|----------|
| T29 | `ask Google "what time is it" and show the answer` | INITIATE→GOOGLE("what time is it")→LCD_MESSAGE |
| T30 | `speak the number 42` | INITIATE→TEXTTOVOICE with MATH_NUMBER(42) |

---

## Group 9 — Session persistence (re-open popup between steps)
| # | Input | Expected |
|---|-------|----------|
| T31 | Run **T3**, then close & reopen the popup | Session restored from storage; workspace blocks still listed in context |
| T32 *(continue after T31)* | `change the frequency to 1*pi` | Gemini emits `modify`; `spawnStats.drag=0` — proves persistence works across SW restart |
