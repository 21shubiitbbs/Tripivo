import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { Txt } from './ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'YYYY-MM-DD' for a local date. */
export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "15 October 2026" */
export function formatLongDate(value: string) {
  const date = fromIsoDate(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "15 Oct" */
export function formatShortDate(value: string) {
  const date = fromIsoDate(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function nightsBetween(start: string, end: string) {
  return Math.round((fromIsoDate(end).getTime() - fromIsoDate(start).getTime()) / 86_400_000);
}

/** A field that shows the picked date and opens a calendar below it when tapped. */
export function DatePickerField({
  placeholder,
  value,
  onChange,
  minDate,
}: {
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  minDate?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityHint="Opens a calendar"
        accessibilityRole="button"
        onPress={() => setIsOpen((open) => !open)}
        style={styles.field}
      >
        <Ionicons color={colors.textMuted} name="calendar-outline" size={18} />
        <Txt color={value ? 'default' : 'subtle'} style={styles.fieldText}>
          {value ? formatShortDate(value) : placeholder}
        </Txt>
        {value ? (
          <Pressable accessibilityLabel="Clear date" hitSlop={10} onPress={() => onChange(null)}>
            <Ionicons color={colors.textSubtle} name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </Pressable>
      {isOpen ? (
        <Calendar
          minDate={minDate}
          onChange={(date) => {
            onChange(date);
            setIsOpen(false);
          }}
          value={value}
        />
      ) : null}
    </View>
  );
}

/** A month grid. Days before `minDate` can't be picked. */
export function Calendar({
  value,
  onChange,
  minDate,
}: {
  value: string | null;
  onChange: (value: string) => void;
  minDate?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const initial = value ? fromIsoDate(value) : minDate ? fromIsoDate(minDate) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  // Monday-first offset of the 1st, then the days of the month.
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIsoDate(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];

  function shiftMonth(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Previous month" hitSlop={10} onPress={() => shiftMonth(-1)}>
          <Ionicons color={colors.text} name="chevron-back" size={20} />
        </Pressable>
        <Txt variant="bodyStrong">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Txt>
        <Pressable accessibilityLabel="Next month" hitSlop={10} onPress={() => shiftMonth(1)}>
          <Ionicons color={colors.text} name="chevron-forward" size={20} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((day, i) => (
          <View key={`w${i}`} style={styles.cell}>
            <Txt color="subtle" variant="caption">
              {day}
            </Txt>
          </View>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = Boolean(minDate && iso < minDate);
          const selected = iso === value;
          return (
            <Pressable
              accessibilityLabel={formatLongDate(iso)}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              key={iso}
              onPress={() => onChange(iso)}
              style={styles.cell}
            >
              <View style={[styles.day, selected && styles.daySelected]}>
                <Text style={[styles.dayText, disabled && styles.dayDisabled, selected && styles.dayTextSelected]}>
                  {Number(iso.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  fieldText: { flex: 1 },
  calendar: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: c.primary },
  dayText: { color: c.text, fontSize: 14 },
  dayTextSelected: { color: c.onPrimary, fontWeight: '700' },
  dayDisabled: { color: c.textSubtle, opacity: 0.5 },
}));
