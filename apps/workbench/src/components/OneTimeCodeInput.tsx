import React, { useRef } from 'react';
import {
  ONE_TIME_CODE_LENGTH,
  clearOneTimeCodeSlot,
  insertOneTimeCodeDigits,
  toOneTimeCodeSlots,
  type OneTimeCode,
} from '../lib/oneTimeCode';
import './OneTimeCodeInput.css';

interface OneTimeCodeInputProps {
  value: readonly string[] | string;
  onChange: (nextValue: OneTimeCode) => void;
  disabled?: boolean;
  firstInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  ariaLabelledBy?: string;
}

export const OneTimeCodeInput: React.FC<OneTimeCodeInputProps> = ({
  value,
  onChange,
  disabled = false,
  firstInputRef,
  ariaLabelledBy,
}) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const slots = toOneTimeCodeSlots(value);

  const focusSlot = (index: number) => {
    window.requestAnimationFrame(() => inputRefs.current[index]?.focus());
  };

  const insertDigits = (index: number, rawValue: string) => {
    const result = insertOneTimeCodeDigits(slots, index, rawValue);
    if (!result.inserted) return false;
    onChange(result.value);
    focusSlot(result.focusIndex);
    return true;
  };

  return (
    <div className="axi-one-time-code" aria-label="六位数字验证码" aria-labelledby={ariaLabelledBy} role="group">
      {slots.map((slot, index) => (
        <input
          key={index}
          ref={(node) => {
            inputRefs.current[index] = node;
            if (index === 0 && firstInputRef) firstInputRef.current = node;
          }}
          aria-label={`验证码第 ${index + 1} 位`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className="axi-one-time-code__input"
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          onChange={(event) => {
            const rawValue = event.currentTarget.value;
            if (rawValue) {
              insertDigits(index, rawValue);
              return;
            }
            onChange(clearOneTimeCodeSlot(slots, index));
          }}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (/^\d$/.test(event.key)) {
              event.preventDefault();
              insertDigits(index, event.key);
              return;
            }
            if (event.key === 'Backspace' && !slots[index] && index > 0) {
              event.preventDefault();
              onChange(clearOneTimeCodeSlot(slots, index - 1));
              focusSlot(index - 1);
              return;
            }
            if (event.key === 'ArrowLeft' && index > 0) {
              event.preventDefault();
              focusSlot(index - 1);
              return;
            }
            if (event.key === 'ArrowRight' && index < ONE_TIME_CODE_LENGTH - 1) {
              event.preventDefault();
              focusSlot(index + 1);
            }
          }}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData('text');
            if (!pastedText) return;
            event.preventDefault();
            insertDigits(index, pastedText);
          }}
          pattern="[0-9]*"
          type="text"
          value={slot}
        />
      ))}
    </div>
  );
};
