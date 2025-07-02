import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";

function valuetext(value: number) {
  const hour = Math.floor(value / 60);
  const min = value % 60;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

export interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (range: [number, number]) => void;
  deviceName?: string;
}

const minTime = 0; // 0:00 AM
const maxTime = 1439; // 23:59 PM

export default function ScheduleDialog({ open, onClose, onSubmit, deviceName }: ScheduleDialogProps) {
  const [value, setValue] = useState<[number, number]>([480, 1020]); // 8:00 AM to 5:00 PM

  const handleChange = (_: Event, newValue: number | number[]) => {
    setValue(newValue as [number, number]);
  };

  const handleSubmit = () => {
    onSubmit(value);
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
          {valuetext(value[0])} - {valuetext(value[1])}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
