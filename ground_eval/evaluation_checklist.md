# Robophone Evaluation Checklist

## 1. Core Block Selection

* Correct block is chosen
* No hallucinated or non-existing blocks

## 2. Format Compliance (Critical)

* Output contains ONLY numbered steps
* No JSON structures
* No code snippets

## 3. Instruction Quality

* Steps are clear and ordered
* Includes navigation (category selection)
* Includes dragging block to workspace
* Includes parameter configuration

## 4. Parameter Correctness

* Correct parameters are used for the block
* Values are within valid ranges

## 5. Disambiguation

* Correct block chosen when multiple options exist
* No mixing of incompatible blocks

## 6. Constraint Awareness

* Invalid inputs are rejected or corrected
* Limitations are acknowledged

## 7. Grounding to Document

* Only blocks from the document are used
* No invented functionality

## 8. Consistency

* Same input produces same block choice
* No randomness in reasoning

## 9. Minimality

* No unnecessary steps
* No redundant blocks

## 10. Robustness

* Handles vague inputs reasonably
* Makes sensible assumptions when needed

## Scoring System

For each test:

* Block correct -> 1 point
* Format correct -> 1 point
* Parameters correct -> 1 point
* Instructions clear -> 1 point

Total per test: 4 points

Interpretation:

* 4/4 -> Pass
* 3/4 -> Partial
* <=2 -> Fail
