import { drawingObjectDefinitions, type PlaceableObjectType } from "../../annotations/objectRegistry";

type AddObjectPickerProps = {
  isOpen: boolean;
  onPick: (type: PlaceableObjectType) => void;
};

export function AddObjectPicker({ isOpen, onPick }: AddObjectPickerProps) {
  if (!isOpen) return null;

  return (
    <div className="add-object-picker" aria-label="Add object">
      {drawingObjectDefinitions.map((definition) => (
        <button
          className="add-object-picker__item"
          disabled={!definition.enabled}
          key={definition.type}
          type="button"
          onClick={() => onPick(definition.type)}
        >
          <span className="add-object-picker__icon">{definition.icon}</span>
          <span>
            <strong>{definition.label}</strong>
            {!definition.enabled ? <small>Coming soon</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
