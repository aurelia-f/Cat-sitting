public class PostgraduateStudent extends Student {
    private String info;

    public PostgraduateStudent(String name, int studentId, String info){
        super(name, studentId);
        this.info=info;
    }

    public class PostgraduateAcademicRecord extends AcademicRecord{
        public PostgraduateAcademicRecord (String module, int mark ){
            super(module, mark);
        }

        @Override
        public void displayRecord(){
            super.displayRecord();
            System.out.println("Info: "+ info);
        }
    }

}

