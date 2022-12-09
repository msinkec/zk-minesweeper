import {useCallback, useEffect, useState} from 'react';
import { callContractRevealFunc } from '../smartContract';
import { GameData } from '../storage';
import {IField, FieldsMap, FieldCoords, ISettings} from '../types';
import {randomNumber} from '../utils/helpers';
import { mineFieldArrToInt, mineFieldMimc } from '../zk';

// Debug cycles counter
let cycles = 0;

// Changes field coords into convenient Map key
function coordsToKey([x, y]: FieldCoords): string {
  return `[${x},${y}]`;
}

export default function useGame(settings: ISettings) {
  // Array of game fields
  const [fields, setFields] = useState<FieldsMap>({
      map: new Map(),
      mapInt: BigInt(0),
      mapCommit: "",
      mapMineCount: 0,
    });
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
    const fields: FieldsMap = {
      map: new Map(),
      mapInt: BigInt(0),
      mapCommit: "",
      mapMineCount: 0,
    };

    for (let y = 0; y < settings.yFieldsCount; y++) {
      for (let x = 0; x < settings.xFieldsCount; x++) {
        cycles += 1;
        const coords: FieldCoords = [x + 1, y + 1];
        fields.map.set(coordsToKey(coords), {
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
    async (): Promise<FieldsMap> => {
      const fields: FieldsMap = generateEmptyFields();
      const fieldsWithBombsIds: Set<number> = new Set();
      
      // TODO: Make random.
      const mineFieldArr = [ 
        0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,
        0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,
        0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
        0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,
        0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,
        0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,
        0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,
        0,1,0,0,0,0,1,0,0,0,0,1,1,0,0,
        0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,
      ];
      let mineCount = 32;
      let mineFieldInt = await mineFieldArrToInt(mineFieldArr);
      let mineFieldCommit = await mineFieldMimc(mineFieldInt);
      
      fields.mapInt = mineFieldInt;
      fields.mapCommit = mineFieldCommit;
      fields.mapMineCount = 32;
      
      for (let i = 0; i < 15*15; i++) {
        if (mineFieldArr[i] == 1) {
          fieldsWithBombsIds.add(i + 1);
        }
      }

      for (const field of fields.map.values()) {
        cycles += 1;
        field.hasBomb = fieldsWithBombsIds.has(field.id);

        if (field.hasBomb) {
          findCoordsAround(field.coords)
            // eslint-disable-next-line no-loop-func
            .map((coords) => {
              cycles += 1;
              return fields.map.get(coordsToKey(coords));
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
      const clickedFieldToOpen = fields.map.get(coordsToKey(clickedField.coords));

      if (clickedFieldToOpen) {
        clickedFieldToOpen.isOpened = true;
        opened += 1;
      }

      if (deletedFlags) {
        setFlagsCount(flagsCount - deletedFlags);
      }
      
      setFields(fields);
      setFieldsOpened(fieldsOpened + opened);
    },
    [findCoordsAround, fieldsOpened, flagsCount],
  );

  const openFieldWithBombsAround = useCallback(
    (clickedField: IField): void => {
      for (const field of fields.map.values()) {
        cycles += 1;
        if (clickedField.id === field.id) {
          field.isOpened = true;
          break;
        }
      }

      //setFields(new Map(fields));
      setFields(fields);
      setFieldsOpened(fieldsOpened + 1);
    },
    [fields, fieldsOpened],
  );

  const openAllBombs = useCallback((): void => {
    let opened = 0;
    for (const field of fields.map.values()) {
      cycles += 1;
      if (field.hasBomb) {
        field.isOpened = true;
        opened += 1;
      }
      if (opened >= settings.bombsCount) {
        break;
      }
    }

    //setFields(new Map(fields));
    setFields(fields);
  }, [fields, settings]);

  const setFlagValue = useCallback(
    (clickedField: IField, value: boolean) => {
      for (const field of fields.map.values()) {
        cycles += 1;
        if (clickedField.id === field.id) {
          field.hasFlag = value;
          break;
        }
      }

      //setFields(new Map(fields));
      setFields(fields);
      setFlagsCount(value ? flagsCount + 1 : flagsCount - 1);
    },
    [fields, flagsCount],
  );

  // Public methods
  const initFields = useCallback(async () => {
    setFields(await generateFieldsWithBombs());
    setFieldsOpened(0);
    setFlagsCount(0);
  }, [generateFieldsWithBombs]);

  // Main public handler for field click
  const openField = useCallback(
    async (clickedField: IField) => {
      
      if (clickedField.isOpened) {
        return; // Don't do anything if the field is already opened
      }
        
      if (clickedField.hasBomb) {
        // Handle click on field with bomb.
        // Show all bombs. Game (also contract) will be finished before already.
        openAllBombs();
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
