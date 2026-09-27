import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { makeStyles, useTheme } from '../theme';

export const CODE_LENGTH = 6;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;
const KEY_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

/**
 * Six digit boxes backed by one invisible input (so paste and SMS/email autofill work when the
 * boxes are tapped), plus an on-screen keypad. `onChange` gets digits only.
 */
export function CodeEntry({
  value,
  onChange,
  disabled = false,
  hasError = false,
  showKeypad = true,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  showKeypad?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  function change(next: string) {
    onChange(next.replace(/\D/g, '').slice(0, CODE_LENGTH));
  }

  function pressKey(key: (typeof KEYS)[number]) {
    if (disabled || !key) return;
    change(key === 'delete' ? value.slice(0, -1) : value + key);
  }

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const isActive = index === Math.min(value.length, CODE_LENGTH - 1) && !disabled;
          return (
            <View key={index} style={[styles.codeBox, isActive && styles.codeBoxActive, hasError && styles.codeBoxError]}>
              <Text style={styles.codeDigit}>{value[index] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          accessibilityLabel="Verification code"
          autoComplete="one-time-code"
          caretHidden
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          onChangeText={change}
          ref={inputRef}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          value={value}
        />
      </Pressable>

      {showKeypad ? (
        <View style={styles.keypad}>
          {KEYS.map((key, index) => (
            <View key={index} style={styles.keyCell}>
              {key ? (
                <Pressable
                  accessibilityLabel={key === 'delete' ? 'Delete' : key}
                  accessibilityRole="button"
                  onPress={() => pressKey(key)}
                  style={({ pressed }) => [styles.key, key === 'delete' && styles.keyPlain, pressed && styles.keyPressed]}
                >
                  {key === 'delete' ? (
                    <Ionicons color={colors.text} name="backspace-outline" size={24} />
                  ) : (
                    <>
                      <Text style={styles.keyDigit}>{key}</Text>
                      {KEY_LETTERS[key] ? <Text style={styles.keyLetters}>{KEY_LETTERS[key]}</Text> : null}
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  codeBox: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
  },
  codeBoxActive: { borderColor: c.primary },
  codeBoxError: { borderColor: c.danger },
  codeDigit: { color: c.text, fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, marginHorizontal: -4 },
  keyCell: { width: '33.333%', padding: 4 },
  key: { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.surfaceAlt },
  keyPlain: { backgroundColor: 'transparent' },
  keyPressed: { backgroundColor: c.border },
  keyDigit: { color: c.text, fontSize: 22, fontWeight: '600' },
  keyLetters: { color: c.textSubtle, fontSize: 9, fontWeight: '600', letterSpacing: 1.5 },
}));
