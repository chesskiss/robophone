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




# =========================
# Virtual Display (Extended)
# =========================

### led_8bit
block_id: led_8bit
display_name: 8LED
category: virtual_display

function:
  summary: Displays an 8-bit numeric value as LED states
  when_to_use:
    - visualize binary values
    - debug bit-level operations
  when_not_to_use:
    - text display → use lcd blocks

inputs:
  - name: value
    type: number
    range: [0, 255]
    required: true
  - name: color
    type: enum
    values: [red, yellow, green, blue]

outputs: none

connections:
  type: statement
  accepts_previous: true
  accepts_next: true
  accepts_children: false

constraints:
  - value must be 0–255

visual_signature:
  shape: rectangular display
  contains_text: [8LED]
  distinctive: row of 8 small lights

image_ref: virtual_display/8led.png

---

### line_bar
block_id: line_bar
display_name: Line Bar
category: virtual_display

function:
  summary: Displays a continuous value as a bar (like potentiometer)
  when_to_use:
    - show normalized or continuous values

inputs:
  - name: value
    type: number
    range: [-100, 100]

outputs: none

connections:
  type: statement
  accepts_previous: true
  accepts_next: true

visual_signature:
  shape: horizontal bar
  contains_text: [bar]

image_ref: virtual_display/line_bar.png

---

### segment_3x7
block_id: segment_3x7
display_name: 3x7Segment
category: virtual_display

function:
  summary: Displays numeric or segment-based output on 7-segment display
  when_to_use:
    - display numeric values in hardware-like format

inputs:
  - name: mode
    type: enum
    values: [numeric, msb, middle, lsb]

outputs: none

connections:
  type: statement
  accepts_previous: true
  accepts_next: true

visual_signature:
  shape: segmented digits
  contains_text: [7SEG]

image_ref: virtual_display/3x7segment.png

---

### graph_draw_on
block_id: graph_draw_on
display_name: Graph Draw On
category: virtual_display

function:
  summary: Collects data over time and plots graphs
  when_to_use:
    - continuous data acquisition
    - real-time plotting

inputs:
  - name: duration
    type: number
  - name: rate
    type: number
  - name: source
    type: enum
    values: [robot, smartphone]

outputs: none

connections:
  type: statement

visual_signature:
  shape: graph
  contains_text: [graph, timeline]

image_ref: virtual_display/graph_draw_on.png

---

### graph_trendline
block_id: graph_trendline
display_name: Draw Trendline
category: virtual_display

function:
  summary: Computes regression line from graph data
  when_to_use:
    - extract model (linear, etc.)
    - compute coefficients

inputs:
  - name: function_type
    type: enum
  - name: timeframe
    type: number

outputs:
  - coefficients

connections:
  type: statement

visual_signature:
  shape: graph_line
  contains_text: [trendline]

image_ref: virtual_display/trendline.png

---

### graph_save
block_id: graph_save
display_name: Save Graph
category: virtual_display

function:
  summary: Saves graph to CSV file

inputs:
  - name: graph_color
    type: enum

outputs:
  - filename

connections:
  type: statement

image_ref: virtual_display/save_graph.png

---

### graph_load
block_id: graph_load
display_name: Load Graph
category: virtual_display

function:
  summary: Loads graph from CSV file

inputs:
  - name: file
    type: string

outputs: none

connections:
  type: statement

image_ref: virtual_display/load_graph.png

---

### graph_reset
block_id: graph_reset
display_name: Reset Graph
category: virtual_display

function:
  summary: Removes graph by color

inputs:
  - name: graph_color
    type: enum

outputs: none

connections:
  type: statement

image_ref: virtual_display/reset_graph.png

---

### component_toggle
block_id: component_toggle
display_name: Load/Unload Component
category: virtual_display

function:
  summary: Shows or hides display component

inputs:
  - name: component
    type: enum

outputs: none

connections:
  type: statement

image_ref: virtual_display/component_toggle.png





# =========================
# Physical Sensors
# =========================

### angle_scalar
block_id: angle_scalar
display_name: Angle (scalar)
category: physical_sensors

function:
  summary: Returns device rotation angle in degrees
inputs: []
outputs:
  - number (degrees)

connections:
  type: value
  outputs_to: numeric_inputs

visual_signature:
  contains_text: [angle]

image_ref: sensors/angle.png

---

### gyro_rate
block_id: gyro_rate
display_name: Gyro Rate
category: physical_sensors

function:
  summary: Returns angular velocity (deg/sec)
inputs: []
outputs:
  - number

connections:
  type: value

image_ref: sensors/gyro.png

---

### acceleration
block_id: acceleration
display_name: Linear Acceleration
category: physical_sensors

function:
  summary: Returns acceleration on selected axis
inputs:
  - axis: [x,y,z]
outputs:
  - number

connections:
  type: value

image_ref: sensors/acceleration.png

---

### gps
block_id: gps
display_name: GPS
category: physical_sensors

function:
  summary: Returns location data (lat, lon, altitude, distance)
inputs: []
outputs:
  - multi_value

connections:
  type: value

image_ref: sensors/gps.png

# =========================
# Virtual Sensors
# =========================

### keypad_numeric
block_id: keypad_numeric
display_name: Keypad Numeric
category: virtual_sensors

function:
  summary: Gets numeric input from user
inputs: []
outputs:
  - number

connections:
  type: value

image_ref: virtual/keypad_numeric.png

---

### button
block_id: button
display_name: Button
category: virtual_sensors

function:
  summary: Waits for user interaction
inputs:
  - message: string
outputs: none

connections:
  type: statement

image_ref: virtual/button.png

---

### keyboard_text
block_id: keyboard_text
display_name: Keyboard Alpha Numeric
category: virtual_sensors

function:
  summary: Gets text input from user
inputs: []
outputs:
  - string

connections:
  type: value

image_ref: virtual/keyboard.png

---

### joystick
block_id: joystick
display_name: Joystick
category: virtual_sensors

function:
  summary: Returns X,Y coordinates of joystick
inputs: []
outputs:
  - x
  - y

connections:
  type: value

image_ref: virtual/joystick.png

---

### potentiometer
block_id: potentiometer
display_name: Potentiometers
category: virtual_sensors

function:
  summary: Returns analog value from user control
inputs:
  - index
outputs:
  - number [-100,100]

connections:
  type: value

image_ref: virtual/potentiometer.png





# =========================
# Advanced Sensors
# =========================

### color_ambient
block_id: color_ambient
display_name: Color Ambient Light
category: advanced_sensors

function:
  summary: Measures ambient light intensity (0-100%)
inputs: []
outputs:
  - number [0-100]

connections:
  type: value

constraints:
  - output normalized 0–100

visual_signature:
  contains_text: [light]

image_ref: sensors/ambient.png

---

### color_detect
block_id: color_detect
display_name: Color Detect
category: advanced_sensors

function:
  summary: Detects one of predefined colors from camera
inputs: []
outputs:
  - number [0-7]

connections:
  type: value

constraints:
  - mapping: 0 none, 1 black, 2 blue, 3 green, 4 yellow, 5 red, 6 white, 7 brown

visual_signature:
  contains_text: [color]

image_ref: sensors/color_detect.png

---

### sound_amplitude
block_id: sound_amplitude
display_name: Sound Amplitude
category: advanced_sensors

function:
  summary: Measures sound level (0-100%)
inputs: []
outputs:
  - number

connections:
  type: value

image_ref: sensors/sound.png

---

### touch_sensor
block_id: touch_sensor
display_name: Touch Sensor
category: advanced_sensors

function:
  summary: Returns true if proximity threshold met
inputs: []
outputs:
  - bool

connections:
  type: value

image_ref: sensors/touch.png

---

### face_recognition
block_id: face_recognition
display_name: Face Recognition
category: advanced_sensors

function:
  summary: Identifies closest known face
inputs:
  - name: person_name
    type: string
outputs:
  - string (recognized name)

connections:
  type: value

constraints:
  - works only for stored faces

visual_signature:
  contains_text: [face]

image_ref: sensors/face_recognition.png

---

### face_position
block_id: face_position
display_name: Get Position By Name
category: advanced_sensors

function:
  summary: Returns face coordinates and distance
inputs:
  - name: person_name
    type: string
outputs:
  - x
  - y
  - height_cm
  - distance_cm

connections:
  type: value

image_ref: sensors/face_position.png


# =========================
# Communication
# =========================

### text_to_voice
block_id: text_to_voice
display_name: Text to Voice
category: communication

function:
  summary: Converts text to speech
inputs:
  - text: string
  - volume: [0-100]
  - repeat_flag: enum
outputs: none

connections:
  type: statement

image_ref: comm/tts.png

---

### voice_to_text
block_id: voice_to_text
display_name: Voice to Text
category: communication

function:
  summary: Converts speech to text
inputs:
  - language: [hebrew, english, arabic]
  - overwrite: bool
outputs:
  - string

connections:
  type: value

image_ref: comm/stt.png

---

### send_sms
block_id: send_sms
display_name: Send SMS
category: communication

function:
  summary: Sends SMS message
inputs:
  - phone_number: string
  - content: string
outputs: none

connections:
  type: statement

image_ref: comm/send_sms.png

---

### get_sms
block_id: get_sms
display_name: Get SMS
category: communication

function:
  summary: Reads incoming SMS
inputs: []
outputs:
  - string

connections:
  type: value

image_ref: comm/get_sms.png

---

### ask_llm
block_id: ask_llm
display_name: Ask Gemini or ChatGPT
category: communication

function:
  summary: Sends query to LLM service
inputs:
  - text: string
outputs: none

connections:
  type: statement

image_ref: comm/ask_llm.png





# =========================
# Data Operations (Firebase + Files)
# =========================

### write_line_file
block_id: write_line_file
display_name: Write Line to File
category: data_operations

function:
  summary: Writes a string line into a file
inputs:
  - file_name: string
  - text: string
outputs: none

connections:
  type: statement

constraints:
  - file must be writable

image_ref: data/write_line.png

---

### read_line_file
block_id: read_line_file
display_name: Read Line from File
category: data_operations

function:
  summary: Reads a line from file
inputs:
  - file_name: string
outputs:
  - string

connections:
  type: value

image_ref: data/read_line.png

---

### delete_file
block_id: delete_file
display_name: Delete File
category: data_operations

function:
  summary: Deletes a file permanently
inputs:
  - file_name: string
outputs: none

connections:
  type: statement

image_ref: data/delete_file.png

---

### firebase_init
block_id: firebase_init
display_name: Initialize DB
category: data_operations

function:
  summary: Connects to Firebase database
inputs:
  - url: string
outputs: none

connections:
  type: statement

image_ref: firebase/init.png

---

### firebase_write
block_id: firebase_write
display_name: Write Key
category: data_operations

function:
  summary: Writes value to database key
inputs:
  - key: string
  - value: any
outputs: none

connections:
  type: statement

image_ref: firebase/write.png

---

### firebase_read
block_id: firebase_read
display_name: Read Key
category: data_operations

function:
  summary: Reads value from database key
inputs:
  - key: string
outputs:
  - any

connections:
  type: value

image_ref: firebase/read.png

---

### firebase_delete_key
block_id: firebase_delete_key
display_name: Delete Key
category: data_operations

function:
  summary: Deletes key from database
inputs:
  - key: string
outputs: none

connections:
  type: statement

image_ref: firebase/delete_key.png

---

### firebase_wait_change
block_id: firebase_wait_change
display_name: Wait Until Key Changes
category: data_operations

function:
  summary: Blocks execution until key value changes
inputs:
  - key: string
outputs: none

connections:
  type: statement

image_ref: firebase/wait_change.png

---

### storage_init
block_id: storage_init
display_name: Initialize Storage
category: data_operations

function:
  summary: Connects to storage service
inputs:
  - url: string
outputs: none

connections:
  type: statement

image_ref: storage/init.png

---

### upload_file
block_id: upload_file
display_name: Upload File
category: data_operations

function:
  summary: Uploads file to storage
inputs:
  - file_name: string
  - type: enum [image, video, audio, csv]
outputs: none

connections:
  type: statement

image_ref: storage/upload.png

---

### download_file
block_id: download_file
display_name: Download File
category: data_operations

function:
  summary: Downloads file from storage
inputs:
  - file_name: string
  - type: enum
outputs: none

connections:
  type: statement

image_ref: storage/download.png

---

### storage_delete
block_id: storage_delete
display_name: Delete File (Storage)
category: data_operations

function:
  summary: Deletes file from storage
inputs:
  - file_name: string
  - type: enum
outputs: none

connections:
  type: statement

image_ref: storage/delete.png


# =========================
# Smartphone
# =========================

### data_acquisition
block_id: data_acquisition
display_name: Data Acquisition
category: smartphone

function:
  summary: Samples smartphone sensors and saves to file
inputs:
  - file_name: string
  - sensors: list
  - duration_sec: number
  - rate_hz: number
outputs: none

connections:
  type: statement

constraints:
  - rate: 0–100 Hz

visual_signature:
  contains_text: [data, acquisition]

image_ref: smartphone/data_acquisition.png





# =========================
# Flow Control
# =========================

### start_program
block_id: start_program
display_name: Start Program
category: flow_control

function:
  summary: Entry point of program execution
inputs: []
outputs: none

connections:
  type: container
  accepts_children: true
  accepts_previous: false
  accepts_next: false

constraints:
  - must be top-level root block

visual_signature:
  contains_text: [start]

image_ref: flow/start.png

---

### start_task
block_id: start_task
display_name: Start Task
category: flow_control

function:
  summary: Defines a separate runnable task
inputs: []
outputs: none

connections:
  type: container
  accepts_children: true

image_ref: flow/start_task.png

---

### stop_task
block_id: stop_task
display_name: Stop Task
category: flow_control

function:
  summary: Stops a running task
inputs: []
outputs: none

connections:
  type: statement

image_ref: flow/stop_task.png

---

### repeat_n
block_id: repeat_n
display_name: Repeat N Times
category: flow_control

function:
  summary: Executes loop fixed number of times
inputs:
  - count: number
outputs: none

connections:
  type: container
  accepts_children: true

image_ref: flow/repeat_n.png

---

### repeat_until
block_id: repeat_until
display_name: Repeat Until
category: flow_control

function:
  summary: Loops until condition met
inputs:
  - condition: bool
outputs: none

connections:
  type: container
  accepts_children: true

image_ref: flow/repeat_until.png

---

### repeat_increment
block_id: repeat_increment
display_name: Repeat and Increment
category: flow_control

function:
  summary: Loop with counter increment
inputs:
  - variable
  - start
  - max
  - step
outputs: none

connections:
  type: container

image_ref: flow/repeat_increment.png

---

### if_condition
block_id: if_condition
display_name: If
category: flow_control

function:
  summary: Executes block if condition true
inputs:
  - condition: bool
outputs: none

connections:
  type: container
  accepts_children: true

image_ref: flow/if.png

---

### if_else
block_id: if_else
display_name: If Else
category: flow_control

function:
  summary: Executes one of two branches
inputs:
  - condition: bool
outputs: none

connections:
  type: container
  accepts_children: true

image_ref: flow/if_else.png

---

### break_loop
block_id: break_loop
display_name: Break
category: flow_control

function:
  summary: Exits loop early
inputs:
  - mode: enum
outputs: none

connections:
  type: statement

image_ref: flow/break.png

---

### wait
block_id: wait
display_name: Wait
category: flow_control

function:
  summary: Pauses execution for time
inputs:
  - time
  - unit: [ms, sec]
outputs: none

connections:
  type: statement

image_ref: flow/wait.png

---

### timer_value
block_id: timer_value
display_name: Timer Value
category: flow_control

function:
  summary: Returns timer value
inputs:
  - timer_id
  - unit
outputs:
  - number

connections:
  type: value

image_ref: flow/timer.png

---

### timer_compare
block_id: timer_compare
display_name: Timer Compare
category: flow_control

function:
  summary: Compares timer with value
inputs:
  - timer_id
  - value
  - comparison
outputs:
  - bool

connections:
  type: value

image_ref: flow/timer_compare.png

---

### reset_timer
block_id: reset_timer
display_name: Reset Timer
category: flow_control

function:
  summary: Resets timer
inputs:
  - timer_id
outputs: none

connections:
  type: statement

image_ref: flow/reset_timer.png

---

### conditional_wait
block_id: conditional_wait
display_name: Conditional Wait
category: flow_control

function:
  summary: Waits until condition becomes true
inputs:
  - condition
outputs: none

connections:
  type: statement

image_ref: flow/conditional_wait.png

---

### exit_program
block_id: exit_program
display_name: Exit Program
category: flow_control

function:
  summary: Stops program execution
inputs: []
outputs: none

connections:
  type: statement

image_ref: flow/exit.png


# =========================
# Logic
# =========================

### logical_condition
block_id: logical_condition
display_name: Logical Condition
category: logic

function:
  summary: Evaluates boolean expression
inputs:
  - condition
outputs:
  - bool

connections:
  type: value

image_ref: logic/condition.png

---

### not_operator
block_id: not_operator
display_name: Not
category: logic

function:
  summary: Inverts boolean/bit value
inputs:
  - value
outputs:
  - value

connections:
  type: value

image_ref: logic/not.png

---

### bitwise_operation
block_id: bitwise_operation
display_name: Bitwise Operation
category: logic

function:
  summary: Performs bitwise operations
inputs:
  - a
  - b
  - operation
outputs:
  - number

connections:
  type: value

constraints:
  - inputs 0–255

image_ref: logic/bitwise.png

---

### binary_to_decimal
block_id: binary_to_decimal
display_name: Binary to Decimal
category: logic

function:
  summary: Converts 4-bit binary to decimal
inputs:
  - bits
outputs:
  - number [0-15]

connections:
  type: value

image_ref: logic/bin_to_dec.png

---

### decimal_to_binary
block_id: decimal_to_binary
display_name: Decimal to Binary
category: logic

function:
  summary: Converts decimal to 4-bit binary
inputs:
  - number
outputs:
  - bits

connections:
  type: value

image_ref: logic/dec_to_bin.png

---

### conditional_value
block_id: conditional_value
display_name: Conditional Value
category: logic

function:
  summary: Returns value based on condition
inputs:
  - condition
  - true_value
  - false_value
outputs:
  - value

connections:
  type: value

image_ref: logic/ternary.png





# =========================
# Math
# =========================

### int_value
block_id: int_value
display_name: Integer Value
category: math

function:
  summary: Returns a constant integer
inputs: []
outputs:
  - number

connections:
  type: value

image_ref: math/int_value.png

---

### math_operation
block_id: math_operation
display_name: Operation (2 values)
category: math

function:
  summary: Performs arithmetic on two numbers
inputs:
  - a
  - b
  - operation: [+, -, *, /, ^]
outputs:
  - number

connections:
  type: value

image_ref: math/op2.png

---

### math_expression
block_id: math_expression
display_name: Expression (a,b,c,x)
category: math

function:
  summary: Evaluates expression using parameters
inputs:
  - a
  - b
  - c
  - x
  - expression_string
outputs:
  - number

connections:
  type: value

image_ref: math/expression.png

---

### unary_operation
block_id: unary_operation
display_name: Unary Operation
category: math

function:
  summary: Applies function to single number
inputs:
  - value
  - operation: [sqrt, abs, neg, ln, log10, exp, 10^x, 2^x]
outputs:
  - number

connections:
  type: value

image_ref: math/unary.png

---

### trig_function
block_id: trig_function
display_name: Trigonometric Function
category: math

function:
  summary: Computes trig function in degrees
inputs:
  - value
  - operation: [sin, cos, tan, asin, acos, atan]
outputs:
  - number

connections:
  type: value

constraints:
  - input in degrees

image_ref: math/trig.png

---

### rounding
block_id: rounding
display_name: Rounding & Numeric Ops
category: math

function:
  summary: Applies rounding or integer operations
inputs:
  - value
  - operation: [round, ceil, floor, truncate, remainder, int_div]
outputs:
  - number

connections:
  type: value

image_ref: math/round.png

---

### list_statistics
block_id: list_statistics
display_name: List Statistics
category: math

function:
  summary: Computes statistical values from list
inputs:
  - list
  - operation
outputs:
  - number

connections:
  type: value

image_ref: math/list_stats.png

---

### constrain_value
block_id: constrain_value
display_name: Constrain Value
category: math

function:
  summary: Clamps value between bounds
inputs:
  - min
  - max
  - value
outputs:
  - number

connections:
  type: value

image_ref: math/constrain.png

---

### atan2
block_id: atan2
display_name: Arctan2
category: math

function:
  summary: Computes angle from X,Y coordinates
inputs:
  - x
  - y
outputs:
  - number [-180,180]

connections:
  type: value

image_ref: math/atan2.png

---

### random_fraction
block_id: random_fraction
display_name: Random Fraction
category: math

function:
  summary: Returns random float [0,1)
inputs: []
outputs:
  - number

connections:
  type: value

image_ref: math/random_fraction.png

---

### random_integer
block_id: random_integer
display_name: Random Integer
category: math

function:
  summary: Returns random integer in range
inputs:
  - min
  - max
outputs:
  - number

connections:
  type: value

image_ref: math/random_int.png

---

### number_property
block_id: number_property
display_name: Number Property Check
category: math

function:
  summary: Checks numeric property
inputs:
  - value
  - property: [even, odd, prime, positive, negative, divisible]
outputs:
  - bool

connections:
  type: value

image_ref: math/property.png

---

### number_compare
block_id: number_compare
display_name: Number Comparison
category: math

function:
  summary: Compares two numbers
inputs:
  - a
  - b
  - operator: [=, !=, <, <=, >, >=]
outputs:
  - bool

connections:
  type: value

image_ref: math/compare.png

---

### range_check
block_id: range_check
display_name: Range Check
category: math

function:
  summary: Checks if value is inside/outside range
inputs:
  - value
  - min
  - max
  - mode: [inside, outside]
outputs:
  - bool

connections:
  type: value

image_ref: math/range.png


# =========================
# Variables
# =========================

### set_variable
block_id: set_variable
display_name: Set Variable
category: variables

function:
  summary: Assigns value to variable
inputs:
  - variable
  - value
outputs: none

connections:
  type: statement

image_ref: vars/set.png

---

### get_variable
block_id: get_variable
display_name: Get Variable
category: variables

function:
  summary: Returns variable value
inputs: []
outputs:
  - value

connections:
  type: value

image_ref: vars/get.png

---

### change_variable
block_id: change_variable
display_name: Change Integer Variable
category: variables

function:
  summary: Increments/decrements variable
inputs:
  - variable
  - delta
outputs: none

connections:
  type: statement

image_ref: vars/change.png

---

### compare_variable
block_id: compare_variable
display_name: Compare Variable
category: variables

function:
  summary: Compares variable to value
inputs:
  - variable
  - value
outputs:
  - bool

connections:
  type: value

image_ref: vars/compare.png

---

### toggle_bool
block_id: toggle_bool
display_name: Toggle Bool
category: variables

function:
  summary: Flips boolean variable
inputs:
  - variable
outputs: none

connections:
  type: statement

image_ref: vars/toggle.png





# =========================
# Text
# =========================

### string_value
block_id: string_value
display_name: String Value
category: text

function:
  summary: Creates or concatenates string values
inputs:
  - values: list[string]
outputs:
  - string

connections:
  type: value

image_ref: text/string_value.png

---

### compare_strings
block_id: compare_strings
display_name: Compare Strings
category: text

function:
  summary: Checks if two strings are equal
inputs:
  - a: string
  - b: string
outputs:
  - bool

connections:
  type: value

image_ref: text/compare.png

---

### is_empty_string
block_id: is_empty_string
display_name: Is String Empty
category: text

function:
  summary: Returns true if string is empty
inputs:
  - text: string
outputs:
  - bool

connections:
  type: value

image_ref: text/is_empty.png

---

### string_length
block_id: string_length
display_name: String Length
category: text

function:
  summary: Returns length of string
inputs:
  - text: string
outputs:
  - number

connections:
  type: value

image_ref: text/length.png

---

### append_text
block_id: append_text
display_name: Append Text
category: text

function:
  summary: Appends text to existing string variable
inputs:
  - variable: string
  - text: string
outputs: none

connections:
  type: statement

image_ref: text/append.png

---

### char_at
block_id: char_at
display_name: Char At
category: text

function:
  summary: Returns character at index
inputs:
  - text: string
  - index: number
outputs:
  - string

connections:
  type: value

constraints:
  - index must be within string bounds

image_ref: text/char_at.png

---

### find_substring
block_id: find_substring
display_name: Find Substring
category: text

function:
  summary: Finds substring index
inputs:
  - text: string
  - substring: string
outputs:
  - number

connections:
  type: value

constraints:
  - returns -1 if not found

image_ref: text/find_substring.png

---

### get_substring
block_id: get_substring
display_name: Get Substring
category: text

function:
  summary: Extracts substring from index range
inputs:
  - text: string
  - start: number
  - end: number
outputs:
  - string

connections:
  type: value

image_ref: text/substr.png

---

### case_convert
block_id: case_convert
display_name: Case Conversion
category: text

function:
  summary: Converts string case
inputs:
  - text: string
  - mode: [upper, lower, title]
outputs:
  - string

connections:
  type: value

image_ref: text/case.png

---

### translate_text
block_id: translate_text
display_name: Translate
category: text

function:
  summary: Translates text between languages
inputs:
  - source_lang
  - target_lang
  - text
outputs:
  - string

connections:
  type: value

image_ref: text/translate.png

---

### run_link
block_id: run_link
display_name: Run Link
category: text

function:
  summary: Opens a web link
inputs:
  - url: string
outputs: none

connections:
  type: statement

image_ref: text/link.png


# =========================
# Lists
# =========================

### create_list
block_id: create_list
display_name: Create Empty List
category: lists

function:
  summary: Creates an empty list
inputs: []
outputs:
  - list

connections:
  type: value

image_ref: lists/create.png

---

### list_init
block_id: list_init
display_name: Initialize List
category: lists

function:
  summary: Creates list with predefined values
inputs:
  - length
  - values
outputs:
  - list

connections:
  type: value

image_ref: lists/init.png

---

### list_repeat
block_id: list_repeat
display_name: Repeat Value List
category: lists

function:
  summary: Creates list of repeated value
inputs:
  - length
  - value
outputs:
  - list

connections:
  type: value

image_ref: lists/repeat.png

---

### list_length
block_id: list_length
display_name: List Length
category: lists

function:
  summary: Returns number of elements
inputs:
  - list
outputs:
  - number

connections:
  type: value

image_ref: lists/length.png

---

### list_is_empty
block_id: list_is_empty
display_name: List Is Empty
category: lists

function:
  summary: Checks if list is empty
inputs:
  - list
outputs:
  - bool

connections:
  type: value

image_ref: lists/is_empty.png

---

### list_find
block_id: list_find
display_name: Find Element
category: lists

function:
  summary: Finds index of element
inputs:
  - list
  - value
outputs:
  - number

connections:
  type: value

image_ref: lists/find.png

---

### list_get_remove
block_id: list_get_remove
display_name: Get/Remove Element
category: lists

function:
  summary: Gets or removes element at index
inputs:
  - list
  - index
  - mode
outputs:
  - value

connections:
  type: value

image_ref: lists/get_remove.png

---

### list_set_insert
block_id: list_set_insert
display_name: Set/Insert Element
category: lists

function:
  summary: Sets or inserts value into list
inputs:
  - list
  - index
  - value
outputs: none

connections:
  type: statement

image_ref: lists/set_insert.png

---

### list_sublist
block_id: list_sublist
display_name: Sublist
category: lists

function:
  summary: Returns portion of list
inputs:
  - list
  - start
  - end
outputs:
  - list

connections:
  type: value

image_ref: lists/sublist.png

---

### list_text_convert
block_id: list_text_convert
display_name: List/Text Conversion
category: lists

function:
  summary: Converts between list and text
inputs:
  - value
  - delimiter
  - mode
outputs:
  - list_or_text

connections:
  type: value

image_ref: lists/convert.png

---

### list_sort
block_id: list_sort
display_name: Sort List
category: lists

function:
  summary: Sorts list
inputs:
  - list
  - mode
outputs:
  - list

connections:
  type: value

image_ref: lists/sort.png





# =========================
# Robot
# =========================

### move_steering
block_id: move_steering
display_name: Move Steering
category: robot

function:
  summary: Moves robot with steering + power control
inputs:
  - steering: number [-100,100]
  - power: number
  - time: number
  - degrees: number
  - brake: bool
  - complete: bool
outputs: none

connections:
  type: statement

constraints:
  - steering range [-100,100]

visual_signature:
  contains_text: [steering]

image_ref: robot/move_steering.png

---

### move_direction
block_id: move_direction
display_name: Move Direction
category: robot

function:
  summary: Moves robot with directional turning control
inputs:
  - direction: enum [clockwise, counterclockwise]
  - power: number
  - angle: number
  - complete: bool
outputs: none

connections:
  type: statement

image_ref: robot/move_direction.png

---

### move_tank
block_id: move_tank
display_name: Move Tank
category: robot

function:
  summary: Controls left/right motors independently
inputs:
  - left_power
  - right_power
  - time
  - degrees
  - brake
  - complete
outputs: none

connections:
  type: statement

image_ref: robot/move_tank.png

---

### motor_large
block_id: motor_large
display_name: Large Motor
category: robot

function:
  summary: Controls single motor
inputs:
  - power
  - time
  - degrees
  - brake
  - complete
outputs: none

connections:
  type: statement

image_ref: robot/motor_large.png

---

### motor_unregulated
block_id: motor_unregulated
display_name: Unregulated Motor
category: robot

function:
  summary: Controls motor without speed regulation
inputs:
  - power
  - time
  - degrees
  - brake
  - complete
outputs: none

connections:
  type: statement

image_ref: robot/motor_unregulated.png

---

### robot_reset
block_id: robot_reset
display_name: Reset Robot
category: robot

function:
  summary: Resets robot sensors
inputs: []
outputs: none

connections:
  type: statement

image_ref: robot/reset.png

---

### robot_sensor_read
block_id: robot_sensor_read
display_name: Read Robot Sensor
category: robot

function:
  summary: Returns value from robot sensor
inputs:
  - sensor_type
outputs:
  - value

connections:
  type: value

image_ref: robot/sensor_read.png

---

### servo_180
block_id: servo_180
display_name: Servo 180
category: robot

function:
  summary: Sets servo angle (0–180)
inputs:
  - port: enum [S1,S2,S3,S4]
  - angle: [0,180]
outputs: none

connections:
  type: statement

constraints:
  - angle 0–180

image_ref: robot/servo180.png

---

### servo_360
block_id: servo_360
display_name: Servo 360
category: robot

function:
  summary: Controls continuous servo
inputs:
  - port
  - power [-100,100]
  - on_off
outputs: none

connections:
  type: statement

image_ref: robot/servo360.png

---

### pid_controller
block_id: pid_controller
display_name: PID Controller
category: robot

function:
  summary: Sets PID parameters for motors
inputs:
  - kp
  - ki
  - kd
  - boost
outputs: none

connections:
  type: statement

image_ref: robot/pid.png

---

### set_robot_name
block_id: set_robot_name
display_name: Set Robot Name
category: robot

function:
  summary: Assigns robot identifier
inputs:
  - name: string
outputs: none

connections:
  type: statement

image_ref: robot/name.png

---

### motion_accelerated
block_id: motion_accelerated
display_name: Uniform Acceleration Motion
category: robot

function:
  summary: Moves robot with constant acceleration
inputs:
  - steering
  - acceleration
  - time
  - v0
  - brake
  - complete
outputs: none

connections:
  type: statement

image_ref: robot/acceleration.png

