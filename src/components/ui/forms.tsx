import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Eye,
  EyeOff,
  Info,
  Search,
  TriangleAlert,
  X
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes
} from 'react';

type FieldTone = 'default' | 'error' | 'success' | 'warning';

type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type FormFieldProps = {
  label: string;
  helper?: string;
  message?: string;
  tone?: FieldTone;
  emphasis?: boolean;
  compact?: boolean;
  htmlFor?: string;
  children: ReactNode;
};

type SwitchFieldProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type CheckboxFieldProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type RadioGroupProps = {
  name: string;
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
};

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  onClear?: () => void;
  shortcutHint?: string;
};

type SelectInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  ariaLabel?: string;
  className?: string;
};

type DateTimePickerProps = {
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fieldFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric'
});

export function FormField({
  label,
  helper,
  message,
  tone = 'default',
  emphasis = false,
  compact = false,
  htmlFor,
  children
}: FormFieldProps) {
  return (
    <div className={clsx('field-root', emphasis && 'emphasized', compact && 'compact')}>
      <div className="field-label-stack">
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
        {helper ? <p className="field-helper">{helper}</p> : null}
      </div>
      {children}
      {message ? <FieldMessage tone={tone}>{message}</FieldMessage> : null}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('form-control-shell', className)}>
      <input className="form-control-input" {...props} />
    </div>
  );
}

export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={clsx('form-control-shell has-trailing-action', className)}>
      <input className="form-control-input" type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="control-inline-button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function NumberInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('form-control-shell number-control-shell', className)}>
      <input className="form-control-input numeric-input" type="number" {...props} />
    </div>
  );
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={clsx('form-control-shell textarea-shell', className)}>
      <textarea className="form-control-input form-control-textarea" {...props} />
    </div>
  );
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({
    value,
    onChange,
    onClear,
    shortcutHint,
    className,
    ...props
  }, ref) {
    const hasValue = typeof value === 'string' ? value.length > 0 : false;

    return (
      <div className={clsx('form-control-shell search-control-shell', className)}>
        <span className="form-control-leading" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          ref={ref}
          className="form-control-input"
          type="search"
          value={value}
          onChange={onChange}
          {...props}
        />
        {shortcutHint ? <span className="keyboard-hint">{shortcutHint}</span> : null}
        {hasValue ? (
          <button
            type="button"
            className="control-inline-button"
            aria-label="Clear search"
            onClick={onClear}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    );
  }
);

export function SelectInput({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  searchable = false,
  ariaLabel,
  className
}: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  
  const selectedOption = options.find((option) => option.value === value);
  
  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) {
      return options;
    }

    const normalizedQuery = query.toLowerCase();
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query, searchable]);

  useOutsideDismiss(rootRef, open, () => setOpen(false));

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);

    window.setTimeout(() => {
      if (searchable) {
        searchRef.current?.focus();
      }
    }, 10);
  }, [filteredOptions, open, searchable, value]);

  const commit = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
    buttonRef.current?.focus();
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (!filteredOptions.length) return;
    setHighlightedIndex((current) => {
      const next = current + direction;
      if (next < 0) return filteredOptions.length - 1;
      if (next >= filteredOptions.length) return 0;
      return next;
    });
  };

  const handlePopoverKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    }

    if (event.key === 'Enter') {
      if (filteredOptions[highlightedIndex]) {
        event.preventDefault();
        commit(filteredOptions[highlightedIndex].value);
      }
    }
  };

  return (
    <div className={clsx('select-root', className)} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={clsx('form-control-shell select-trigger', open && 'open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
      >
        <span className="select-trigger-copy">
          <span className="select-trigger-value">{selectedOption?.label ?? placeholder}</span>
          {selectedOption?.description ? (
            <span className="select-trigger-description">{selectedOption.description}</span>
          ) : null}
        </span>
        <ChevronDown size={14} className="select-chevron" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="select-popover"
            onKeyDown={handlePopoverKeyDown}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.985 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {searchable ? (
              <div className="select-search-shell">
                <Search size={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="select-search-input"
                  placeholder="Search options"
                />
              </div>
            ) : null}

            <div
              id={listId}
              role="listbox"
              className="select-options"
              tabIndex={-1}
            >
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    key={option.value}
                    className={clsx(
                      'select-option',
                      option.value === value && 'selected',
                      index === highlightedIndex && 'highlighted'
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => commit(option.value)}
                  >
                    <span className="select-option-copy">
                      <span>{option.label}</span>
                      {option.description ? <small>{option.description}</small> : null}
                    </span>
                    {option.value === value ? <Check size={14} /> : null}
                  </button>
                ))
              ) : (
                <div className="select-empty-state">No matching options</div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Choose a date and time'
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseIsoDate(value);
  const [draftDate, setDraftDate] = useState<Date>(selectedDate ?? new Date());
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(selectedDate ?? new Date()));
  const calendarDays = useMemo(() => buildCalendar(visibleMonth), [visibleMonth]);

  useOutsideDismiss(rootRef, open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const nextDate = selectedDate ?? new Date();
    setDraftDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
  }, [open, selectedDate]);

  const commit = (nextDate: Date) => {
    setDraftDate(nextDate);
    onChange(nextDate.toISOString());
  };

  const updateTime = (nextTime: string) => {
    const [hours, minutes] = nextTime.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;

    const nextDate = new Date(draftDate);
    nextDate.setHours(hours, minutes, 0, 0);
    commit(nextDate);
  };

  const selectDay = (day: Date) => {
    const nextDate = new Date(draftDate);
    nextDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    commit(nextDate);
  };

  return (
    <div className="date-time-root" ref={rootRef}>
      <button
        type="button"
        className={clsx('form-control-shell date-time-trigger', open && 'open')}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="form-control-leading" aria-hidden="true">
          <CalendarDays size={16} />
        </span>
        <span className={clsx('date-time-value', !selectedDate && 'placeholder')}>
          {selectedDate ? fieldFormat.format(selectedDate) : placeholder}
        </span>
        {selectedDate ? (
          <button
            type="button"
            className="control-inline-button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(undefined);
            }}
            aria-label="Clear date and time"
          >
            <X size={14} />
          </button>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="date-time-popover"
            role="dialog"
            aria-label="Date and time selector"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.985 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="date-time-header">
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{monthFormat.format(visibleMonth)}</strong>
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((day) => {
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const isMuted = day.getMonth() !== visibleMonth.getMonth();
                const isToday = isSameDay(day, new Date());
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    className={clsx(
                      'calendar-day',
                      isSelected && 'selected',
                      isMuted && 'muted',
                      isToday && 'today'
                    )}
                    onClick={() => selectDay(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="time-selector-row">
              <div className="time-selector-label">
                <Clock3 size={14} />
                <span>Time</span>
              </div>
              <div className="time-input-shell">
                <input
                  type="time"
                  step={60}
                  className="time-input"
                  value={formatTimeValue(draftDate)}
                  onChange={(event) => updateTime(event.target.value)}
                />
              </div>
            </div>

            <div className="date-time-actions">
              <button
                type="button"
                className="select-footer-button"
                onClick={() => commit(new Date())}
              >
                Use Now
              </button>
              <button
                type="button"
                className="select-footer-button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function CheckboxField({
  label,
  description,
  checked,
  onChange
}: CheckboxFieldProps) {
  return (
    <label className={clsx('choice-card checkbox-card', checked && 'active')}>
      <input
        className="choice-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-indicator" aria-hidden="true">
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0.72, opacity: checked ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        >
          <Check size={14} />
        </motion.span>
      </span>
      <span className="choice-copy">
        <span className="choice-label">{label}</span>
        {description ? <span className="choice-description">{description}</span> : null}
      </span>
    </label>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onChange
}: SwitchFieldProps) {
  return (
    <label className={clsx('choice-card switch-card', checked && 'active')}>
      <input
        className="choice-input"
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="choice-copy">
        <span className="choice-label">{label}</span>
        {description ? <span className="choice-description">{description}</span> : null}
      </span>
      <motion.span
        className="switch-indicator"
        initial={false}
        animate={{ backgroundColor: checked ? 'rgba(145, 113, 255, 0.92)' : 'rgba(255, 255, 255, 0.12)' }}
        transition={{ duration: 0.2 }}
      >
        <motion.span
          className="switch-thumb"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </motion.span>
    </label>
  );
}

export function RadioGroup({
  name,
  label,
  options,
  value,
  onChange
}: RadioGroupProps) {
  return (
    <div className="radio-group-root" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={clsx('choice-card radio-card', option.value === value && 'active')}>
          <input
            className="choice-input"
            type="radio"
            name={name}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="radio-indicator" aria-hidden="true">
            {option.value === value ? <Circle size={14} fill="currentColor" /> : <Circle size={14} />}
          </span>
          <span className="choice-copy">
            <span className="choice-label">{option.label}</span>
            {option.description ? <span className="choice-description">{option.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function FieldMessage({
  tone,
  children
}: {
  tone: FieldTone;
  children: ReactNode;
}) {
  const icon = {
    default: <Info size={14} />,
    error: <AlertCircle size={14} />,
    success: <CheckCircle2 size={14} />,
    warning: <TriangleAlert size={14} />
  }[tone];

  return (
    <motion.div
      className={clsx('field-message', tone !== 'default' && `tone-${tone}`)}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -3 }}
      transition={{ duration: 0.18 }}
    >
      <span className="field-message-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </motion.div>
  );
}

function useOutsideDismiss(
  ref: React.RefObject<HTMLElement>,
  active: boolean,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, onDismiss, ref]);
}

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date) {
  const normalized = new Date(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function buildCalendar(month: Date) {
  const start = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export type SegmentOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  options: SegmentOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  className
}: SegmentedControlProps) {
  const resolvedOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const activeIndex = resolvedOptions.findIndex((opt) => opt.value === value);
  const widthPercentage = 100 / resolvedOptions.length;

  return (
    <div className={clsx('segmented-control-container', className)}>
      {activeIndex >= 0 ? (
        <div
          className="segmented-control-slider"
          style={{
            width: `calc(${widthPercentage}% - 6px)`,
            transform: `translateX(calc(${activeIndex * 100}% + 3px))`
          }}
        />
      ) : null}
      {resolvedOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx('segment-btn', option.value === value && 'active')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
