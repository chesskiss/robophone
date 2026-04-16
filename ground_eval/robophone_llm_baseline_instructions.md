# Robophone LLM Baseline Document

## Overview

Robophone is a visual programming framework that allows users to build applications by assembling blocks instead of writing traditional code.

Programs are created by selecting blocks from categorized panels and placing them onto a workspace. Each block represents a specific action or operation.

The system is designed to control and interact with a virtual smartphone environment, including displaying information, handling logic, and processing data.

---

## Core Concepts

### Block-Based Programming

Users construct programs by:

* selecting blocks from a side panel
* dragging them into a central workspace
* connecting them in a valid sequence

Each block represents a single operation.

---

### Categories

Blocks are grouped into categories such as:

* Flow Control
* Virtual Display
* Sensors
* Logic

Users must navigate these categories to find the appropriate block.

---

### Program Structure

A valid program:

* starts with a designated entry block (e.g. start/run)
* consists of a sequence of connected blocks
* executes from top to bottom

---

### Interaction Model

To build a program, users:

1. Select a category from the right panel
2. Choose a block
3. Drag the block into the workspace
4. Configure its parameters
5. Connect it to other blocks

---

### Output Behavior

Programs can:

* display text on a virtual screen
* visualize data
* react to inputs
* perform logical operations

---

## Important Notes for the Model

* The system is block-based, not code-based
* Outputs should be described as step-by-step block interactions
* The goal is to guide a user in assembling blocks visually
* Do not assume access to traditional programming constructs unless represented as blocks

---

## Limitations of This Document

This document does NOT define:

* specific block names
* block parameters
* exact capabilities of individual blocks

It only describes the general structure and usage of the Robophone system.
