import { useState, useEffect } from "react"; // Add useEffect import
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";

// Import Schema type
import type { Schema } from "../amplify/data/resource"; // Adjust path if necessary

function valuetext(value: number) {
  const hour = Math.floor(value / 60);
  const min = value % 60;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

// UPDATED: ScheduleDialogProps interface
export interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  // Change onSubmit to accept a Promise<void> as handleScheduleSubmit is async
  onSubmit: (range: [number, number]) => Promise<void>;
  deviceName?: string;
  // ADDED: deviceToSchedule prop
  deviceToSchedule: Schema["Device"]["type"] | null; // This declares the new prop
}

const minTime = 0; // 0:00 AM
const maxTime = 1439; // 23:59 PM

export default function ScheduleDialog({
  open,
  onClose,
  onSubmit,
  deviceName,
  deviceToSchedule, // ADDED: Destructure the new prop here
}: ScheduleDialogProps) {
  const [value, setValue] = useState<[number, number]>([480, 1020]); // Default: 8:00 AM to 5:00 PM

  // Use useEffect to set initial slider values when the dialog opens or deviceToSchedule changes
  useEffect(() => {
    if (open && deviceToSchedule) {
      // Set slider values from deviceToSchedule, falling back to defaults if undefined/null
      const start = deviceToSchedule.scheduleFrom !== undefined && deviceToSchedule.scheduleFrom !== null
                    ? deviceToSchedule.scheduleFrom
                    : 480; // Default 8:00 AM
      const end = deviceToSchedule.scheduleTo !== undefined && deviceToSchedule.scheduleTo !== null
                  ? deviceToSchedule.scheduleTo
                  : 1020; // Default 5:00 PM
      setValue([start, end]);
    } else if (!open) {
      // Optionally reset to default when closed if you prefer, or keep last state
      setValue([480, 1020]);
    }
  }, [open, deviceToSchedule]); // Dependencies: run when 'open' or 'deviceToSchedule' changes

  const handleChange = (_: Event, newValue: number | number[]) => {
    setValue(newValue as [number, number]);
  };

  const handleSubmit = async () => { // Make handleSubmit async because onSubmit is async
    await onSubmit(value); // Await the submission
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Schedule for {deviceName || "Device"}</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Select allowed time range (AM/PM):
        </Typography>
        <Slider
          value={value}
          onChange={handleChange}
          valueLabelDisplay="auto"
          valueLabelFormat={valuetext}
          min={minTime}
          max={maxTime}
          step={15}
        />
        <Typography>
          Current Range: {valuetext(value[0])} - {valuetext(value[1])}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}