import { A, useNavigate, type AnchorProps } from "@solidjs/router";

export const FastLink = (props: AnchorProps) => {
  const navigate = useNavigate();
  return (
    <A
      {...props}
      onPointerDown={(e) => {
        e.preventDefault();
        navigate(props.href!);
      }}
    />
  );
};
