import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

interface DeviceFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { staticIp: string; wifiMac: string; name: string }) => void;
}

const DeviceFormDialog: React.FC<DeviceFormDialogProps> = ({ open, onClose, onSubmit }) => {
  const [staticIp, setStaticIp] = React.useState("");
  const [wifiMac, setWifiMac] = React.useState("");
  const [name, setName] = React.useState("");

  const handleSubmit = () => {
    if (!staticIp || !wifiMac || !name) return;
    onSubmit({ staticIp, wifiMac, name });
    setStaticIp("");
    setWifiMac("");
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add Device</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Device Name"
          type="text"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Static IP"
          type="text"
          fullWidth
          value={staticIp}
          onChange={e => setStaticIp(e.target.value)}
        />
        <TextField
          margin="dense"
          label="WiFi MAC Address"
          type="text"
          fullWidth
          value={wifiMac}
          onChange={e => setWifiMac(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Add</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeviceFormDialog;
