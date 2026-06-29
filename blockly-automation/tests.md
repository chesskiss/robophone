# Blockly Native SDK Test Programs

Programs use only standard Blockly blocks (controls_for, math_trig, math_arithmetic, variables_get/set, logic_compare, controls_if, lists_*, text, etc.).
No robophone-specific blocks (GRAPH, LCD_MESSAGE, etc.).

---

## Test 1 — Set a variable to a number
**Complexity:** minimal (2 blocks)

Set variable `x` to 42.

---

## Test 2 — Basic arithmetic expression
**Complexity:** low (4 blocks)

Set variable `result` to (3 + 4) × 2.

---

## Test 3 — Trig value into a variable
**Complexity:** low-medium (4 blocks)

Set variable `y` to sin(90).

---

## Test 4 — For loop counting up
**Complexity:** medium (3 blocks)

Count with variable `i` from 1 to 10 by 1. Inside the loop, set variable `total` to `i`.

---

## Test 5 — For loop accumulating a sum
**Complexity:** medium (6 blocks)

Set `total` to 0. Count with `i` from 1 to 100 by 1. Inside the loop, change `total` by `i`.

---

## Test 6 — If/else branch on a comparison
**Complexity:** medium (7 blocks)

If `x` > 10, set `label` to 1, else set `label` to 0.

---

## Test 7 — For loop computing sin of each angle, storing in a variable
**Complexity:** medium-high (8 blocks)

Count with `angle` from 0 to 360 by 10. Inside the loop set `y` to 5 × sin(`angle`).

---

## Test 8 — Nested arithmetic: quadratic formula fragment
**Complexity:** high (10 blocks)

Set `discriminant` to (b × b) − (4 × a × c), where a=1, b=5, c=6 (set those variables first, then compute discriminant).

---

## Test 9 — For loop with conditional inside
**Complexity:** high (10 blocks)

Count with `n` from 1 to 20 by 1. If `n` mod 2 equals 0, set `even` to `n`, else set `odd` to `n`.
(Use math_arithmetic with MODULO or math_number_property for even check — or use logic_compare with remainder.)

---

## Test 10 — Nested loops with accumulator and conditional
**Complexity:** very high (14+ blocks)

Set `total` to 0. Count outer loop `i` from 1 to 5 by 1. Count inner loop `j` from 1 to 5 by 1.
Inside inner loop: if (`i` × `j`) > 10, change `total` by (`i` × `j`).
