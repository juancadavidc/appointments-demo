import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessSettingsPanel } from './business-settings-panel';
import type { BusinessSettings } from '@appointments-demo/types';

describe('BusinessSettingsPanel', () => {
  const mockSettings: BusinessSettings = {
    timezone: 'America/Bogota',
    currency: 'COP',
    businessHours: [
      { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isOpen: true },
      { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isOpen: true },
      { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isOpen: true },
      { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isOpen: true },
      { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isOpen: true },
      { dayOfWeek: 6, openTime: '08:00', closeTime: '14:00', isOpen: true },
      { dayOfWeek: 0, openTime: '10:00', closeTime: '14:00', isOpen: false }
    ]
  };

  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders current settings values', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Check timezone dropdown value
    const timezoneSelect = screen.getByRole('combobox', { name: /zona horaria/i });
    expect(timezoneSelect).toHaveValue('America/Bogota');
    
    // Check currency dropdown value  
    const currencySelect = screen.getByRole('combobox', { name: /moneda/i });
    expect(currencySelect).toHaveValue('COP');
  });

  it('shows timezone selection with Colombian default', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    const timezoneSelect = screen.getByRole('combobox', { name: /zona horaria/i });
    expect(timezoneSelect).toHaveValue('America/Bogota');
    
    // Should include other timezone options
    expect(screen.getByRole('option', { name: /bogotá \(colombia\)/i })).toBeInTheDocument();
  });

  it('shows currency fixed as Colombian Peso', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    const currencySelect = screen.getByRole('combobox', { name: /moneda/i });
    expect(currencySelect).toHaveValue('COP');
    expect(currencySelect).toBeDisabled();
    
    // Should show COP as selected and potentially disabled for Colombian system
    expect(screen.getByRole('option', { name: /cop - peso colombiano/i })).toBeInTheDocument();
  });

  it('displays business hours for all days of the week', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Check for Spanish day names
    expect(screen.getByText(/lunes/i)).toBeInTheDocument();
    expect(screen.getByText(/martes/i)).toBeInTheDocument();
    expect(screen.getByText(/miércoles/i)).toBeInTheDocument();
    expect(screen.getByText(/jueves/i)).toBeInTheDocument();
    expect(screen.getByText(/viernes/i)).toBeInTheDocument();
    expect(screen.getByText(/sábado/i)).toBeInTheDocument();
    expect(screen.getByText(/domingo/i)).toBeInTheDocument();
  });

  it('shows business hours with correct time format', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Check for 24-hour format times using getAllByDisplayValue since there are multiple
    expect(screen.getAllByDisplayValue('08:00')).toHaveLength(6); // Monday-Saturday open at 08:00
    expect(screen.getAllByDisplayValue('18:00')).toHaveLength(5); // Monday-Friday close at 18:00  
    expect(screen.getByDisplayValue('14:00')).toBeInTheDocument(); // Saturday close at 14:00
  });

  it('allows toggling business hours on/off for each day', async () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Find the toggle for Sunday (should be off initially)
    const sundayToggle = screen.getByRole('checkbox', { name: /domingo/i });
    expect(sundayToggle).not.toBeChecked();

    // Toggle Sunday on
    await userEvent.click(sundayToggle);
    expect(sundayToggle).toBeChecked();
  });

  it('validates time format (HH:MM)', async () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Find a time input and try to enter invalid format by setting value directly
    const timeInputs = screen.getAllByDisplayValue('08:00');
    const firstTimeInput = timeInputs[0];
    
    // Simulate invalid time by directly changing the input value
    fireEvent.change(firstTimeInput, { target: { value: '25:00' } });

    const saveButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/formato de hora inválido/i)).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('validates that open time is before close time', async () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Set close time before open time
    const timeInputs = screen.getAllByDisplayValue('18:00');
    const closeTimeInput = timeInputs[0];
    
    await userEvent.clear(closeTimeInput);
    await userEvent.type(closeTimeInput, '07:00'); // Before 08:00 open time

    const saveButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/la hora de cierre debe ser posterior a la de apertura/i)).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('calls onSave with updated settings', async () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Change timezone
    const timezoneSelect = screen.getByRole('combobox', { name: /zona horaria/i });
    await userEvent.selectOptions(timezoneSelect, 'America/New_York');

    const saveButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        ...mockSettings,
        timezone: 'America/New_York',
        businessHours: expect.any(Array)
      });
    });
  });

  it('shows loading state during save', async () => {
    const slowMockOnSave = jest.fn(() => new Promise<void>(resolve => setTimeout(resolve, 100)));
    
    render(<BusinessSettingsPanel settings={mockSettings} onSave={slowMockOnSave} />);

    const saveButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/guardando/i)).toBeInTheDocument();
    });
  });

  it('uses Spanish terminology for Colombian business context', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    expect(screen.getByText(/zona horaria/i)).toBeInTheDocument();
    expect(screen.getByText(/moneda/i)).toBeInTheDocument();
    expect(screen.getByText(/horarios de atención/i)).toBeInTheDocument();
    
    // Check for time inputs instead of multiple text occurrences
    expect(screen.getAllByDisplayValue(/\d{2}:\d{2}/)).toHaveLength(12); // 6 days open * 2 times each
  });

  it('handles settings without business hours', () => {
    const settingsWithoutHours = {
      ...mockSettings,
      businessHours: []
    };

    render(<BusinessSettingsPanel settings={settingsWithoutHours} onSave={mockOnSave} />);

    // Should still show day selector with default closed state
    expect(screen.getByText(/lunes/i)).toBeInTheDocument();
    expect(screen.getByText(/domingo/i)).toBeInTheDocument();
  });

  it('provides helpful information about Colombian timezone', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Should have some context about Colombian timezone
    expect(screen.getByText(/recomendado: bogotá para negocios colombianos/i)).toBeInTheDocument();
  });

  it('shows Colombian peso currency information', () => {
    render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    // Should show peso context
    expect(screen.getByText(/peso colombiano para tu negocio local/i)).toBeInTheDocument();
  });

  it('applies correct responsive styling', () => {
    const { container } = render(<BusinessSettingsPanel settings={mockSettings} onSave={mockOnSave} />);

    expect(container.firstChild).toHaveClass('bg-white', 'shadow', 'rounded-lg');
  });
});