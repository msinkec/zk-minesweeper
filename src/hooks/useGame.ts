import {useCallback, useEffect, useState} from 'react';
import { callContractRevealFunc } from '../smartContract';
import { GameData } from '../storage';
import {IField, FieldsMap, FieldCoords, ISettings} from '../types';
import {randomNumber} from '../utils/helpers';

// Debug cycles counter
let cycles = 0;

// Changes field coords into convenient Map key
function coordsToKey([x, y]: FieldCoords): string {
  return `[${x},${y}]`;
}

export default function useGame(settings: ISettings) {
  // Array of game fields
  const [fields, setFields] = useState<FieldsMap>(new Map());
  // Array of game fields which has been opened
  const [fieldsOpened, setFieldsOpened] = useState<number>(0);
  // Flags count
  const [flagsCount, setFlagsCount] = useState<number>(0);

  // Private methods
  // Checks if given X and Y coordinates are in game field boundaries
  const areCoordsInBoundaries = useCallback(
    ([x, y]: FieldCoords): boolean => {
      return x >= 1 && x <= settings.xFieldsCount && y >= 1 && y <= settings.yFieldsCount;
    },
    [settings],
  );

  const findCoordsAround = useCallback(
    ([x, y]: FieldCoords): FieldCoords[] => {
      const coords = [
        [x - 1, y - 1],
        [x, y - 1],
        [x + 1, y - 1],
        [x - 1, y],
        [x + 1, y],
        [x - 1, y + 1],
        [x, y + 1],
        [x + 1, y + 1],
      ];

      return coords.filter(([x, y]) => {
        cycles += 1;
        return areCoordsInBoundaries([x, y]);
      }) as FieldCoords[];
    },
    [areCoordsInBoundaries],
  );

  const generateEmptyFields = useCallback((): FieldsMap => {
    const fields: FieldsMap = new Map();

    for (let y = 0; y < settings.yFieldsCount; y++) {
      for (let x = 0; x < settings.xFieldsCount; x++) {
        cycles += 1;
        const coords: FieldCoords = [x + 1, y + 1];
        fields.set(coordsToKey(coords), {
          id: x + 1 + settings.xFieldsCount * y,
          coords,
          isOpened: false,
          hasBomb: false,
          hasFlag: false,
          bombsAround: 0,
        });
      }
    }

    return fields;
  }, [settings]);

  const generateFieldsWithBombs = useCallback(
    (firstClicked: IField): FieldsMap => {
      const fields: FieldsMap = generateEmptyFields();
      const fieldsWithBombsIds: Set<number> = new Set();

      let game = GameData.get()
      for (let i = 0; i < 15*15; i++) {
        if (game.mineFieldArr[i] == 1) {
          fieldsWithBombsIds.add(i + 1);
        }
      }

      for (const field of fields.values()) {
        cycles += 1;
        field.hasBomb = fieldsWithBombsIds.has(field.id);

        if (field.hasBomb) {
          findCoordsAround(field.coords)
            // eslint-disable-next-line no-loop-func
            .map((coords) => {
              cycles += 1;
              return fields.get(coordsToKey(coords));
            })
            // eslint-disable-next-line no-loop-func
            .forEach((field) => {
              cycles += 1;
              return field && field.bombsAround++;
            });
        }
      }

      return fields;
    },
    [findCoordsAround, generateEmptyFields, settings],
  );

  const openEmptyFields = useCallback(
    (clickedField: IField, fields: FieldsMap): void => {
      const emptiesStack: IField[] = [clickedField];
      const verifiedEmptiesIds = new Set<number>();
      let opened = 0;
      let deletedFlags = 0;

      // Open currently clicked field
      const clickedFieldToOpen = fields.get(coordsToKey(clickedField.coords));

      if (clickedFieldToOpen) {
        clickedFieldToOpen.isOpened = true;
        opened += 1;
      }

      if (deletedFlags) {
        setFlagsCount(flagsCount - deletedFlags);
      }

      setFields(new Map(fields));
      setFieldsOpened(fieldsOpened + opened);
    },
    [findCoordsAround, fieldsOpened, flagsCount],
  );

  const openFieldWithBombsAround = useCallback(
    (clickedField: IField): void => {
      for (const field of fields.values()) {
        cycles += 1;
        if (clickedField.id === field.id) {
          field.isOpened = true;
          break;
        }
      }

      setFields(new Map(fields));
      setFieldsOpened(fieldsOpened + 1);
    },
    [fields, fieldsOpened],
  );

  const openAllBombs = useCallback((): void => {
    let opened = 0;
    for (const field of fields.values()) {
      cycles += 1;
      if (field.hasBomb) {
        field.isOpened = true;
        opened += 1;
      }
      if (opened >= settings.bombsCount) {
        break;
      }
    }

    setFields(new Map(fields));
  }, [fields, settings]);

  const setFlagValue = useCallback(
    (clickedField: IField, value: boolean) => {
      for (const field of fields.values()) {
        cycles += 1;
        if (clickedField.id === field.id) {
          field.hasFlag = value;
          break;
        }
      }

      setFields(new Map(fields));
      setFlagsCount(value ? flagsCount + 1 : flagsCount - 1);
    },
    [fields, flagsCount],
  );

  // Public methods
  const initFields = useCallback(() => {
    setFields(generateEmptyFields());
    setFieldsOpened(0);
    setFlagsCount(0);
  }, [generateEmptyFields]);

  // Main public handler for field click
  const openField = useCallback(
    async (clickedField: IField) => {
      // TODO: broadcast contract update here
      // 
      
      console.log("TEST");
      console.log(clickedField);
      console.log(fields);

      let game = GameData.get()
      
      let x = clickedField.coords[0] - 1;
      let y = clickedField.coords[1] - 1;
      let idx = y*15 + x;
  
      let hasBomb = game.mineFieldArr[idx] == 1;

      let coordsAround = findCoordsAround(clickedField.coords);
      let minesAround = coordsAround.map((coords) => { return game.mineFieldArr[(coords[1] - 1) *15 + (coords[0] - 1)]})
                      .reduce((a, b) => a + b, 0);


      if (clickedField.isOpened) {
        return;
      }

      // Call reveal function of the smart contract
      //await callContractRevealFunc(x, y, hasBomb, minesAround);
      
      if (hasBomb) {
        minesAround += 1;
        // Finish contract
      } else {
        // Update contract proving number of neighbor bombs
        // TDOO: call update func
      }
        
      // TODO: instead of generating field here, get it from storage
      if (clickedField.hasBomb) {
        // Handle click on field with bomb
        openAllBombs();
      } else if (fieldsOpened === 0) {
        // Handle first click.
        // Regenerate fields with bombs and then open fields around first clicked field.
        // The first click in any game will never be a mine.
        openEmptyFields(clickedField, generateFieldsWithBombs(clickedField));
      } else if (clickedField.bombsAround === 0) {
        // Handle click on empty field and open fields around it.
        openEmptyFields(clickedField, fields);
      } else {
        openFieldWithBombsAround(clickedField);
      }
    },
    [fields, fieldsOpened, generateFieldsWithBombs, openEmptyFields, openAllBombs, openFieldWithBombsAround],
  );

  const setFlag = useCallback(
    (clickedField: IField) => {
      if (flagsCount >= settings.bombsCount) {
        return;
      }

      setFlagValue(clickedField, true);
    },
    [setFlagValue, flagsCount, settings],
  );

  const deleteFlag = useCallback(
    (clickedField: IField) => {
      if (flagsCount < 1) {
        return;
      }

      setFlagValue(clickedField, false);
    },
    [setFlagValue, flagsCount],
  );

  // Update debug cycles counter on every fields change
  useEffect(() => {
    console.log(`Cycles count: ${cycles}`);
    cycles = 0;
  }, [fields]);

  return {
    fields,
    fieldsOpened,
    openField,
    initFields,
    flagsCount,
    setFlag,
    deleteFlag,
  };
}
