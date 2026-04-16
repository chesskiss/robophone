# Robophone LLM Manual – Virtual Display (Structured)

## Block Registry

### lcd_grid
block_id: lcd_grid
category: virtual_display

visual:
  description: 4x20 LCD display block
  keywords: [lcd, text display, grid]

function:
  summary: Displays text at a specific position on LCD
  when_to_use:
    - display short text
    - precise positioning required

inputs:
  - name: text
    type: string
    required: true
  - name: left_offset
    type: number
    range: [0, 19]
  - name: line
    type: number
    range: [0, 3]
  - name: color
    type: enum
    values: [red, yellow, green, blue]
  - name: size
    type: enum
    values: [small, large]

outputs: none

connections:
  accepts_input_from: any
  outputs_to: display_only

---

### lcd_message
block_id: lcd_message
category: virtual_display

visual:
  description: full width LCD message block
  keywords: [lcd, message, display]

function:
  summary: Displays long text without positioning
  when_to_use:
    - display long messages
    - no need for precise positioning

inputs:
  - name: text
    type: string
    required: true

outputs: none

connections:
  accepts_input_from: any
  outputs_to: display_only

---

### graph_draw_point
block_id: graph_draw_point
category: virtual_display

visual:
  description: graph plotting block
  keywords: [graph, plot, point]

function:
  summary: Draws a point on a graph display
  when_to_use:
    - visualize numeric data
    - plotting values over time

inputs:
  - name: x
    type: number
  - name: y
    type: number

outputs: none

connections:
  accepts_input_from: any
  outputs_to: display_only

---

## Visual Mapping

lcd_grid:
  shape: rectangle
  contains_text: [LCD, Grid]

lcd_message:
  shape: rectangle
  contains_text: [LCD, Message]

graph_draw_point:
  shape: graph_icon
  contains_text: [Graph]

---

## Instruction Templates

lcd_grid:
  - Go to Virtual Display category
  - Select LCD Grid block
  - Drag to workspace
  - Set text
  - Set line
  - Set offset

lcd_message:
  - Go to Virtual Display category
  - Select LCD Message block
  - Drag to workspace
  - Set text

graph_draw_point:
  - Go to Virtual Display category
  - Select Graph Point block
  - Drag to workspace
  - Set X value
  - Set Y value

---

## Atomic Tasks

- input: "display hello world"
  output_block: lcd_message

- input: "display text at position"
  output_block: lcd_grid

- input: "plot value"
  output_block: graph_draw_point

---

## Disambiguation

lcd_grid vs lcd_message:
  lcd_grid:
    - precise position
    - short text
  lcd_message:
    - long text
    - no positioning

---

## Constraints

- lcd_grid.line must be 0-3
- lcd_grid.left_offset must be 0-19
