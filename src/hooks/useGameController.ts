import {useCallback, useEffect, useState} from 'react';
import {FieldsMap, GameState, IField, SettingsLevel} from '../types';
import {formatSeconds} from '../utils/helpers';
import useSettings from './useSettings';
import useGame from './useGame';
import useInterval from './useInterval';

import { Network, SensiletWallet, web3 } from '../web3';
import { mineFieldArrToInt, mineFieldMimc } from '../zk';
import { callContractRevealFunc, callContractUpdateFunc, initializeContract } from '../smartContract';
import { GameData, ContractUtxos } from '../storage';

export default function useGameController() {
  // Use game settings hook
  const {settings, setSettingsByLevel} = useSettings(SettingsLevel.Beginner);
  // Game main logic hook
  const {fields, fieldsOpened, openField, initFields, flagsCount, setFlag, deleteFlag} = useGame(settings);
  // Time in seconds spent on the game
  const [timer, setTimer] = useState<number>(0);
  // Formatted HH:MM:SS `timer`
  const [formattedTimer, setFormattedTimer] = useState<string>('00:00');
  // Current state of the game
  const [gameState, setGameState] = useState<GameState>(GameState.Idle);

  // Public methods
  const prepareGame = useCallback( async () => {
    // Init wallet.
    const wallet =  new SensiletWallet();
    web3.setWallet(wallet);
    const isConnected = await web3.wallet.isConnected();

    if(isConnected) {
      const n = await wallet.getNetwork();

      if(n === Network.Mainnet) {

        alert("your sensilet wallet's network is mainnet, switch to testnet before playing.");
        return;
      }

      web3.setWallet(new SensiletWallet(n));

      await initFields();
      setTimer(0);
      setGameState(GameState.Idle);
    } else {
      alert("Cannot connect Sensilet wallet.");
    }
      
  }, [initFields]);

  const continuePlaying = useCallback(() => {
    setGameState(GameState.Playing);
  }, []);

  const pause = useCallback(() => {
    setGameState(GameState.Pause);
  }, []);
  
  const onFieldOpen = useCallback(
    async (clickedField: IField, fieldsMap: FieldsMap) => {
      if (clickedField.isOpened) {
        return; // Don't do anything if the field is already opened
      }
    
      if (clickedField.hasBomb) {
        setGameState(GameState.GameOver);
        openField(clickedField); // TODO: If we don't update here bombs don't get displayed for some reason.
      } else {
        setGameState(GameState.Pause);
      }
      

      if (fieldsOpened === 0) {
        // If it's the first click, initialize the smart contract itself.
        console.log("initing smart contract");
        try {
          await initializeContract(fieldsMap);
          // Set game state to `Playing`
        } catch (error) {
          console.log("Failed initializing smart contract.")
          console.log(error);
          return;
        }
      }
      
      // As the player clicked, we do a reveal call on the initialized smart contrat.
      console.log("player update");
      await callContractRevealFunc(clickedField, fieldsMap);
      
      // Once the players reveal function was called, the server updates the game state
      // of the smart contract.
      console.log("server updating smart contract");
      await callContractUpdateFunc(clickedField, fieldsMap);

      // Do game state updates.
      if (clickedField.hasBomb) {
        setGameState(GameState.GameOver);
      } else {
        setGameState(GameState.Playing);
      }
      // Open field with `useGame` handler
      openField(clickedField);
    },
    [fieldsOpened, openField]
  );

  // Run `setInterval` every time when `gameState` is GameState.Playing
  useInterval(
    () => {
      setTimer(timer + 1);
    },
    gameState === GameState.Playing ? 1000 : null,
  );

  // Initialize game on mount
  useEffect(() => {
    prepareGame();
  }, [prepareGame]);

  // Regenerate game fields when settings changed
  useEffect(() => {
    prepareGame();
  }, [settings, prepareGame]);

  // Format seconds on each `timer` change
  useEffect(() => {
    setFormattedTimer(formatSeconds(timer));
  }, [timer]);

  // Check game win state
  useEffect(() => {
    if (fieldsOpened + settings.bombsCount === settings.xFieldsCount * settings.yFieldsCount) {
      alert('Congratulations! You won!');
      setGameState(GameState.GameOver);
    }
  }, [fieldsOpened, settings]);

  return {
    settings,
    setSettingsByLevel,
    fields,
    fieldsOpened,
    timer,
    formattedTimer,
    gameState,
    prepareGame,
    continuePlaying,
    pause,
    onFieldOpen,
    flagsCount,
    setFlag,
    deleteFlag,
  };
}
